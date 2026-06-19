import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';

type Props = {
  /** Aviso ya redactado por el backend (`aiMessage`). Render como texto plano. */
  text: string;
  onSwitchCity: () => void;
};

/**
 * Aviso de ciudad no cubierta. NO es un turno normal del asistente: se pinta
 * como tarjeta de aviso destacada con CTA para elegir una ciudad disponible.
 * El texto viene del backend (`cityUnsupported`) y se renderiza como Text plano.
 */
export function CityNoticeBubble({ text, onSwitchCity }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="map-marker-alert" size={20} color={colors.sunsetOrange} />
          <Text style={styles.title}>{t('chat.cityUnsupportedTitle')}</Text>
        </View>
        <Text style={styles.body}>{text}</Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={onSwitchCity}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('chat.cityUnsupportedCta')}
        >
          <MaterialCommunityIcons name="map-marker" size={16} color="#fff" />
          <Text style={styles.ctaText}>{t('chat.cityUnsupportedCta')}</Text>
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
    backgroundColor: 'rgba(255, 247, 237, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
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
    color: colors.sunsetOrange,
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
    backgroundColor: colors.sunsetOrange,
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
