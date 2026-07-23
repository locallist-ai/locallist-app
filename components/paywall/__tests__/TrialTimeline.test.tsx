/**
 * TrialTimeline: los días del recordatorio y del primer cobro se DERIVAN de
 * `trialDays`, nunca literales. Un `t` que expone las opciones de interpolación
 * permite asertar el número renderizado — y falla si la copy asumiera 7/5/8.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { TrialTimeline } from '../TrialTimeline';

// `t` que devuelve `clave|json(opts)` para poder asertar la interpolación.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${JSON.stringify(opts)}` : key,
  }),
}));

it('trial de 7 días: recordatorio día 5 y cobro día 8 (interpolados, no literales)', () => {
  render(<TrialTimeline trialDays={7} priceString="39,99 €" />);

  expect(screen.getByText('paywall.timelineReminderTitle|{"day":5}')).toBeOnTheScreen();
  expect(screen.getByText('paywall.timelineChargeTitle|{"day":8}')).toBeOnTheScreen();
  // El precio se interpola en el cuerpo del cobro.
  expect(screen.getByText('paywall.timelineChargeBody|{"price":"39,99 €"}')).toBeOnTheScreen();
});

it('otra duración (14 días): los días cambian (12/15) — la copy NO está hardcodeada a 5/8', () => {
  render(<TrialTimeline trialDays={14} priceString="49,99 €" />);

  expect(screen.getByText('paywall.timelineReminderTitle|{"day":12}')).toBeOnTheScreen();
  expect(screen.getByText('paywall.timelineChargeTitle|{"day":15}')).toBeOnTheScreen();
  // Nada de "día 5/día 8" en un trial de 14 días.
  expect(screen.queryByText('paywall.timelineReminderTitle|{"day":5}')).toBeNull();
  expect(screen.queryByText('paywall.timelineChargeTitle|{"day":8}')).toBeNull();
});
