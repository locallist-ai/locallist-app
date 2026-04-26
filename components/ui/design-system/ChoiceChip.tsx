import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../../../lib/theme';

// Design system — ChoiceChip.
// Componente base del "lenguaje wizard". Grandes tarjetas con emoji + label +
// animación pulse/glow cuando se seleccionan. Extraído desde components/home/OptionCard
// para reutilizarse en cualquier pantalla (Plans tab, futuros wizards, onboarding).

export interface ChoiceChipProps {
  /** Label text del chip. Si ya pasas el string traducido, úsalo directo. */
  label: string;
  /** Emoji o icono unicode mostrado a la izquierda (fallback si no hay iconName). */
  emoji: string;
  /** MCI icon name. Si se provee, se renderiza en burbuja branded en lugar del emoji.
   *  Mockup 2026-04-25 para reemplazar emojis genéricos por icons de marca. */
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
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
  iconName,
  selected,
  onPress,
  index = 0,
  haptics = true,
  accessibilityLabel,
  testID,
}) => {
  // Pablo 2026-04-26: animaciones eliminadas. ChoiceChip queda estático.
  // Solo se mantiene el ZoomIn del checkmark cuando el chip se selecciona,
  // que es feedback de tap inmediato (no infinite animation).

  const handlePress = () => {
    if (haptics) {
      Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        testID={testID}
      >
        <View
          style={[
            styles.card,
            selected ? styles.cardSelected : styles.cardIdle,
          ]}
        >
          <BlurView intensity={selected ? 70 : 50} tint="light" style={styles.blur}>
              {iconName ? (
                <View style={[styles.iconBubble, selected && styles.iconBubbleSelected]}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={26}
                    color={selected ? '#FFFFFF' : colors.sunsetOrange}
                  />
                </View>
              ) : (
                <Text style={styles.emoji}>{emoji}</Text>
              )}
              <View style={styles.labelContainer}>
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {label}
                </Text>
              </View>
              {selected && (
                <Animated.View entering={ZoomIn.duration(220)}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                </Animated.View>
              )}
            </BlurView>
          </View>
        </TouchableOpacity>
    </View>
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
  cardIdle: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardSelected: {
    borderColor: colors.sunsetOrange,
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
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 233, 0.85)', // paperWhite tinted
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  iconBubbleSelected: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
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
