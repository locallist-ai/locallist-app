import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../../lib/theme';

interface TrialTimelineProps {
  /**
   * Precio localizado (priceString de StoreKit) que se factura el día 8. Se
   * interpola en el paso del primer cobro — el elemento más prominente del
   * timeline, por encima del "gratis".
   */
  priceString: string;
}

/**
 * Timeline vertical Hoy → Día 5 → Día 8 del trial anual. SIN urgencia ni
 * countdowns: describe el compromiso REAL — el día 5 avisamos (lo cumple
 * `lib/trial-reminder/`) y el día 8 llega el primer cobro. Patrón sancionado
 * por Apple 3.1.2 (nada de "toggle" trial/pago ni cuentas atrás).
 *
 * Se monta SOLO cuando el package seleccionado tiene trial real (introPrice
 * gratuito); con un plan sin trial el paywall muestra precio directo y este
 * componente no se renderiza — no se promete un trial que no aplica.
 */
export function TrialTimeline({ priceString }: TrialTimelineProps) {
  const { t } = useTranslation();

  const steps = [
    {
      key: 'today',
      title: t('paywall.timelineTodayTitle'),
      body: t('paywall.timelineTodayBody'),
    },
    {
      key: 'reminder',
      title: t('paywall.timelineReminderTitle'),
      body: t('paywall.timelineReminderBody'),
    },
    {
      key: 'charge',
      title: t('paywall.timelineChargeTitle'),
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
