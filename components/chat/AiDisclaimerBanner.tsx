import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts } from '../../lib/theme';

/**
 * Aviso claro pero no intrusivo de que el chat es IA y puede equivocarse. El
 * chat es el flujo SECUNDARIO opt-in (el wizard determinista es el primario),
 * así que al entrar mostramos esta nota bajo el header. No es un turno del
 * asistente: es una banda fija, siempre visible, que no interfiere con el flujo
 * de mensajes ni con los quick replies.
 */
export function AiDisclaimerBanner() {
  const { t } = useTranslation();
  // Sin accessibilityRole="alert": es una nota estática, no un aviso urgente —
  // "alert" haría que VoiceOver lo re-anunciara en cada remontaje del chat.
  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons
        name="information-outline"
        size={16}
        color="rgba(255, 255, 255, 0.85)"
        style={styles.icon}
      />
      <Text style={styles.text}>{t('chat.aiDisclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
