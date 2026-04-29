import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors } from '../../../lib/theme';

// Design system — ProgressDots.
// Indicador de progreso con dots animados (el activo se expande a 24px).
// Patrón portado desde components/home/ProgressDots.tsx. Extraído al design system
// para reutilizarse en wizard, onboarding, forms multi-step, carousel de stops.

export interface ProgressDotsProps {
  /** Índice del dot activo (0-based). */
  current: number;
  /** Número total de dots. */
  total: number;
  /** Tamaño (height): sm=6, md=8, lg=10. Default: md. */
  size?: 'sm' | 'md' | 'lg';
  /** Color del dot activo. Default: sunsetOrange. */
  colorActive?: string;
  /** Color de dots completados (< current). Default: sunsetOrange 40%. */
  colorCompleted?: string;
  /** Color de dots pendientes (> current). Default: white 30%. */
  colorPending?: string;
}

const SIZE_TO_HEIGHT: Record<NonNullable<ProgressDotsProps['size']>, number> = {
  sm: 6,
  md: 8,
  lg: 10,
};

interface DotProps {
  index: number;
  current: number;
  size: number;
  colorActive: string;
  colorCompleted: string;
  colorPending: string;
}

const Dot: React.FC<DotProps> = React.memo(function Dot({
  index,
  current,
  size,
  colorActive,
  colorCompleted,
  colorPending,
}) {
  const activeWidth = size * 3;
  const animStyle = useAnimatedStyle(() => ({
    width: withTiming(index === current ? activeWidth : size, { duration: 250 }),
    backgroundColor: withTiming(
      index === current
        ? colorActive
        : index < current
          ? colorCompleted
          : colorPending,
      { duration: 250 },
    ),
  }));

  return <Animated.View style={[{ height: size, borderRadius: size / 2 }, animStyle]} />;
});

export const ProgressDots: React.FC<ProgressDotsProps> = ({
  current,
  total,
  size = 'md',
  colorActive = colors.sunsetOrange,
  colorCompleted = 'rgba(249, 115, 22, 0.4)',
  colorPending = 'rgba(255, 255, 255, 0.3)',
}) => {
  const heightPx = SIZE_TO_HEIGHT[size];
  return (
    <View
      style={styles.container}
      accessibilityLabel={`Step ${current + 1} of ${total}`}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: total }).map((_, i) => (
        <Dot
          key={i}
          index={i}
          current={current}
          size={heightPx}
          colorActive={colorActive}
          colorCompleted={colorCompleted}
          colorPending={colorPending}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
});
