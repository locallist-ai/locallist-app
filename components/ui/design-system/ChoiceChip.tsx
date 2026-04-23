import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../../../lib/theme';

// Design system — ChoiceChip.
// Componente base del "lenguaje wizard". Grandes tarjetas con emoji + label +
// animación pulse/glow cuando se seleccionan. Extraído desde components/home/OptionCard
// para reutilizarse en cualquier pantalla (Plans tab, futuros wizards, onboarding).

export interface ChoiceChipProps {
  /** Label text del chip. Si ya pasas el string traducido, úsalo directo. */
  label: string;
  /** Emoji o icono unicode mostrado a la izquierda. */
  emoji: string;
  /** Estado seleccionado — dispara pulse + glow + checkmark. */
  selected: boolean;
  /** Callback cuando el usuario presiona. */
  onPress: () => void;
  /** Index en una lista para stagger de enter animation (default 0). */
  index?: number;
  /** Dispara haptic selection feedback al presionar (default true). */
  haptics?: boolean;
  /** Accessibility label. Default: label. */
  accessibilityLabel?: string;
  /** Para debug/tests. */
  testID?: string;
}

export const ChoiceChip: React.FC<ChoiceChipProps> = React.memo(({
  label,
  emoji,
  selected,
  onPress,
  index = 0,
  haptics = true,
  accessibilityLabel,
  testID,
}) => {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (selected) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.98, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 300 });
      glowOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [selected]);

  const cardScale = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const borderGlow = useAnimatedStyle(() => ({
    borderColor: selected
      ? `rgba(249, 115, 22, ${glowOpacity.value})`
      : 'rgba(255, 255, 255, 0.3)',
  }));

  const handlePress = () => {
    if (haptics) {
      Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <Animated.View entering={FadeInUp.duration(600).delay(200 + index * 120).springify().damping(14)}>
      <Animated.View style={cardScale}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          testID={testID}
        >
          <Animated.View style={[styles.card, selected && styles.cardSelected, borderGlow]}>
            <BlurView intensity={selected ? 70 : 50} tint="light" style={styles.blur}>
              <Text style={styles.emoji}>{emoji}</Text>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {label}
                </Text>
              </View>
              {selected && (
                <Animated.View entering={ZoomIn.duration(300).springify()}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  cardSelected: {
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  blur: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 32,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: 'rgba(15, 23, 42, 0.8)',
  },
  labelSelected: {
    fontFamily: fonts.headingBold,
    color: colors.deepOcean,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
