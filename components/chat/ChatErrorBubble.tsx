import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';

type Props = {
  /** Mensaje genérico ya redactado por el backend (`aiMessage`). Texto plano. */
  text: string;
  onRetry: () => void;
};

/**
 * Estado de error de infraestructura del chat (cadena LLM caída,
 * `error: "ai_unavailable"`). NO es un turno normal del asistente: se pinta
 * como error con acción de reintento. Nunca expone detalle técnico
 * (provider/status): solo el mensaje genérico del backend + el botón.
 */
export function ChatErrorBubble({ text, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="cloud-alert" size={20} color={colors.error} />
          <Text style={styles.title}>{t('chat.aiUnavailableTitle')}</Text>
        </View>
        <Text style={styles.body}>{text}</Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={onRetry}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('chat.aiUnavailableRetry')}
        >
          <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
          <Text style={styles.ctaText}>{t('chat.aiUnavailableRetry')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    backgroundColor: 'rgba(254, 242, 242, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.error,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.deepOcean,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.error,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 2,
  },
  ctaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#fff',
  },
});
