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
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { hapticSelect } from './constants';
import type { StepOption } from './constants';

// ── Types ──

interface OptionCardProps {
  option: StepOption;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

// ── Component ──

export const OptionCard: React.FC<OptionCardProps> = React.memo(({ option, index, selected, onSelect }) => {
  const { t } = useTranslation();
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

  return (
    <Animated.View entering={FadeInUp.duration(600).delay(200 + index * 120).springify().damping(14)}>
      <Animated.View style={cardScale}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            hapticSelect();
            onSelect();
          }}
          accessibilityLabel={t(option.labelKey)}
          accessibilityRole="button"
          accessibilityState={{ selected }}
        >
          <Animated.View
            style={[
              styles.card,
              selected && styles.cardSelected,
              borderGlow,
            ]}
          >
            <BlurView
              intensity={selected ? 70 : 50}
              tint="light"
              style={styles.blur}
            >
              <Text style={styles.emoji}>{option.emoji}</Text>
              <View style={styles.labelContainer}>
                <Text
                  style={[
                    styles.label,
                    selected && styles.labelSelected,
                  ]}
                >
                  {t(option.labelKey)}
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

// ── Styles ──

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

