/**
 * Presents a `GateAction` (from `lib/gate-errors`) as UI.
 *
 * Keeps the code→copy→CTA mapping in ONE place so screens don't each re-invent
 * the upsell/signup wording. Uses `Alert` (consistent with the app's existing
 * upsell and city-unsupported prompts); the upsell CTA routes to the dedicated
 * `/paywall` route (shipped in PR #77) via the single `openPlus` entry point.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth';
import type { GateAction } from './gate-errors';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function formatResetDate(iso: string): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

function upsellCopy(
  action: Extract<GateAction, { type: 'upsell' }>,
  t: TFunc,
): { title: string; body: string } {
  switch (action.code) {
    case 'plan_limit_reached': {
      const limit = action.limit ?? 3;
      const date = action.resetsAt ? formatResetDate(action.resetsAt) : null;
      return {
        title: t('gate.planLimitTitle'),
        body: date
          ? t('gate.planLimitBodyReset', { limit, date })
          : t('gate.planLimitBody', { limit }),
      };
    }
    case 'duration_requires_plus':
      return {
        title: t('gate.durationTitle'),
        body: t('gate.durationBody', {
          maxDays: action.maxDays ?? 3,
          plusMaxDays: action.plusMaxDays ?? 14,
        }),
      };
    case 'multicity_requires_plus':
      return { title: t('gate.multicityTitle'), body: t('gate.multicityBody') };
    case 'saved_plans_limit_reached':
      return {
        title: t('gate.savedPlansTitle'),
        body: t('gate.savedPlansBody', { limit: action.limit ?? 3 }),
      };
  }
}

export function useGateHandler() {
  const { t } = useTranslation();
  const { isPro } = useAuth();

  const openPlus = useCallback(() => {
    // Single Plus entry point — the RevenueCat paywall (PR #77). Centralised so
    // every gate upsell CTA routes to the same place.
    router.push('/paywall');
  }, []);

  /**
   * Show the right prompt for a gate action. Returns a short localised message
   * suitable for inline display (e.g. the wizard's error overlay), or `null`
   * for actions this hook does not own (`rate_limit`, `generic`) — the caller
   * keeps its existing inline handling for those.
   */
  const presentGate = useCallback(
    (action: GateAction): string | null => {
      switch (action.type) {
        case 'signup_required': {
          const body = t('gate.signupRequiredBody');
          Alert.alert(t('gate.signupRequiredTitle'), body, [
            { text: t('gate.maybeLater'), style: 'cancel' },
            { text: t('gate.signupCta'), onPress: () => router.push('/login') },
          ]);
          return body;
        }
        case 'upsell': {
          const { title, body } = upsellCopy(action, t as TFunc);
          Alert.alert(title, body, [
            { text: t('gate.maybeLater'), style: 'cancel' },
            { text: t('gate.upgradeCta'), onPress: openPlus },
          ]);
          return body;
        }
        case 'soft_throttle': {
          const body = t('gate.dailyCapBody');
          Alert.alert(t('gate.dailyCapTitle'), body, [{ text: t('common.ok') }]);
          return body;
        }
        default:
          return null;
      }
    },
    [t, openPlus],
  );

  /**
   * Notify that a generated plan's duration was clamped to the free cap. Shown
   * as a soft upsell — the plan is still valid, so this never blocks the flow.
   */
  const presentClamped = useCallback(
    (appliedDays: number | null) => {
      // A Plus user can still trip the clamp (over-requesting past their 14-day
      // cap). Never upsell an existing Plus subscriber — the backend only emits
      // `clamped` for the free cap today, but this is the client-side guard (g4).
      if (isPro) return;
      Alert.alert(
        t('gate.clampedTitle'),
        appliedDays != null
          ? t('gate.clampedBody', { days: appliedDays })
          : t('gate.clampedBodyGeneric'),
        [
          { text: t('gate.maybeLater'), style: 'cancel' },
          { text: t('gate.upgradeCta'), onPress: openPlus },
        ],
      );
    },
    [t, openPlus, isPro],
  );

  return { presentGate, presentClamped };
}
