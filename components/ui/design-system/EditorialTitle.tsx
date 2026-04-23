import React from 'react';
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { colors, fonts } from '../../../lib/theme';

// Design system — EditorialTitle.
// Title serif (Playfair Display Bold) con line-break narrativo. Soporta shadow
// opcional para legibilidad sobre fondos con imagen. Patrón tomado del wizard
// (WizardStep + HomeV2 cityTitle) para aplicar cross-app como "voz" visual.

export interface EditorialTitleProps {
  /** Texto — puede contener `\n` para line-break narrativo. */
  text: string;
  /** Tamaño: sm (28), md (36), lg (38). Default: md. */
  size?: 'sm' | 'md' | 'lg';
  /** Color del texto. Default: colors.deepOcean. */
  color?: string;
  /** Alineación. Default: center. */
  align?: 'left' | 'center' | 'right';
  /** Shadow para legibilidad sobre imagen/video. Default: false. */
  withShadow?: boolean;
  style?: StyleProp<TextStyle>;
}

const SIZE_TO_STYLE: Record<
  NonNullable<EditorialTitleProps['size']>,
  { fontSize: number; lineHeight: number }
> = {
  sm: { fontSize: 28, lineHeight: 34 },
  md: { fontSize: 36, lineHeight: 44 },
  lg: { fontSize: 38, lineHeight: 46 },
};

export const EditorialTitle: React.FC<EditorialTitleProps> = ({
  text,
  size = 'md',
  color = colors.deepOcean,
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
      allowFontScaling
    >
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.headingBold,
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
