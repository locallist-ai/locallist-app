import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../../lib/theme';
import { trialTimelineFromDays } from '../../lib/trial-timeline';

interface TrialTimelineProps {
  /**
   * Duración del trial en días (N), DERIVADA del `introPrice` del producto — no
   * hardcodeada. Gobierna el día del recordatorio (N-2) y el del primer cobro
   * (N+1): si ASC configura otra duración, la copy la refleja en vez de mentir.
   */
  trialDays: number;
  /**
   * Precio localizado (priceString de StoreKit) que se factura el día N+1. Se
   * interpola en el paso del primer cobro — el elemento más prominente del
   * timeline, por encima del "gratis".
   */
  priceString: string;
}

/**
 * Timeline vertical Hoy → Día N-2 → Día N+1 del trial. SIN urgencia ni
 * countdowns: describe el compromiso REAL — el día N-2 avisamos (lo cumple
 * `lib/trial-reminder/`) y el día N+1 llega el primer cobro. Patrón sancionado
 * por Apple 3.1.2 (nada de "toggle" trial/pago ni cuentas atrás).
 *
 * Los días se DERIVAN de `trialDays` (a su vez derivado del introPrice), nunca
 * literales: para el trial de 7 días real → recordatorio día 5, cobro día 8.
 *
 * Se monta SOLO cuando el package seleccionado tiene trial real (introPrice
 * gratuito) Y el usuario es ELEGIBLE (el paywall lo comprueba con
 * `checkTrialEligibility`); si no, muestra precio directo y este componente no
 * se renderiza — no se promete un trial que no aplica.
 */
export function TrialTimeline({ trialDays, priceString }: TrialTimelineProps) {
  const { t } = useTranslation();
  const { reminderDay, chargeDay } = trialTimelineFromDays(trialDays);

  const steps = [
    {
      key: 'today',
      title: t('paywall.timelineTodayTitle'),
      body: t('paywall.timelineTodayBody'),
    },
    {
      key: 'reminder',
      title: t('paywall.timelineReminderTitle', { day: reminderDay }),
      body: t('paywall.timelineReminderBody'),
    },
    {
      key: 'charge',
      title: t('paywall.timelineChargeTitle', { day: chargeDay }),
      body: t('paywall.timelineChargeBody', { price: priceString }),
      charge: true,
    },
  ];

  return (
    <View style={s.container} testID="paywall-trial-timeline">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <View key={step.key} style={s.row}>
            <View style={s.railCol}>
              <View style={[s.dot, step.charge && s.dotCharge]} />
              {!isLast && <View style={s.line} />}
            </View>
            <View style={[s.content, !isLast && s.contentGap]}>
              <Text style={s.stepTitle}>{step.title}</Text>
              <Text style={[s.stepBody, step.charge && s.stepBodyCharge]}>
                {step.body}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 14;

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row' },
  railCol: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: colors.electricBlue,
    backgroundColor: colors.bgCard,
    marginTop: 3,
  },
  dotCharge: {
    backgroundColor: colors.electricBlue,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.electricBlueLight,
    marginTop: 2,
  },
  content: { flex: 1, marginLeft: spacing.md },
  contentGap: { paddingBottom: spacing.lg },
  stepTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.electricBlue,
    marginBottom: 2,
  },
  stepBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  stepBodyCharge: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
});
