import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, borderRadius, spacing } from '../../../lib/theme';

// Design system — PrimaryButton.
// Botón primario PLANO en sunsetOrange (decisión de Pablo 2026-07-27): el
// naranja plano es el color de "crear/confirmar". NADA de gradiente (el brief
// prohíbe degradados) y el electricBlue se reserva a links/navegación, nunca a
// un CTA primario. Compartido: lo usan el builder manual y, después, la pantalla
// de import. Icono SIEMPRE MCI (el contrato de marca prohíbe emoji-como-icono).

export interface PrimaryButtonProps {
  /** Texto del botón (ya traducido). */
  label: string;
  /** Callback al pulsar. No se dispara si `disabled` o `loading`. */
  onPress: () => void;
  /** Atenúa el botón e ignora las pulsaciones. */
  disabled?: boolean;
  /** Muestra un spinner y bloquea la pulsación (op. en vuelo). */
  loading?: boolean;
  /** Icono MCI opcional a la izquierda del label (nunca emoji). */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Accessibility label. Default: `label`. */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityLabel,
  testID,
  style,
}) => {
  // Una op. en vuelo (loading) también inhabilita la pulsación: nunca se
  // dispara la acción dos veces ni sobre un estado deshabilitado.
  const isInert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInert, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        // Pressed sutil: leve atenuación + escala. Solo cuando es pulsable.
        pressed && !isInert && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          testID="primary-button-spinner"
          size="small"
          color={colors.paperWhite}
        />
      ) : (
        <>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={colors.paperWhite}
              style={styles.icon}
            />
          )}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.sunsetOrange,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  icon: {
    marginRight: 0,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.paperWhite,
  },
});
