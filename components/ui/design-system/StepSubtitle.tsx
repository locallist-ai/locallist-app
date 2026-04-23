import React from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { colors, fonts } from '../../../lib/theme';

// Design system — StepSubtitle.
// Subtítulo body Inter por debajo de un EditorialTitle. Usado en wizard + onboarding
// + cualquier flow narrativo. Shadow opcional para fondos con imagen.

export interface StepSubtitleProps {
  text: string;
  size?: 'sm' | 'md';
  color?: string;
  align?: 'left' | 'center' | 'right';
  withShadow?: boolean;
  style?: StyleProp<TextStyle>;
}

const SIZE_TO_STYLE: Record<
  NonNullable<StepSubtitleProps['size']>,
  { fontSize: number; lineHeight: number }
> = {
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 15, lineHeight: 22 },
};

export const StepSubtitle: React.FC<StepSubtitleProps> = ({
  text,
  size = 'md',
  color = colors.textSecondary,
  align = 'center',
  withShadow = false,
  style,
}) => {
  return (
    <Text
      style={[
        styles.base,
        SIZE_TO_STYLE[size],
        { color, textAlign: align },
        withShadow && styles.shadow,
        style,
      ]}
    >
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.body,
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
