import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { getShowcasePlans, getPlanDetail, clonePlan } from '../../lib/api';
import { getOnboardingPrefsSync } from '../../lib/onboarding-store';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { mapGateError } from '../../lib/gate-errors';
import { setPendingClonePlan, setPendingCloneLanding } from '../../lib/clone-plan-store';
import { track } from '../../lib/analytics';
import { logger } from '../../lib/logger';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import type { Plan } from '../../lib/types';

// Onboarding screen 4: value preview. Shows a REAL curated plan (PhotoHero cover
// pulled from the plan's stops + the first 2-3 stops) so the payoff is concrete
// before the user commits. The plan is picked to match the interests the user
// chose on the tastes screen (there is no city in onboarding; city is chosen in
// the home, builder-first #91). Falls back to a generic category-gradient card
// when there is no showcase plan (never fabricates photos). CTA finishes onboarding.

// Ties an onboarding interest id (see components/home/constants INTEREST_OPTIONS)
// to the showcase plans curated in prod (Romantic / Foodie / Outdoor / Family /
// Culture). Matching is a case-insensitive substring test against each plan's
// name + description + type + tripContext, so it survives however the backend
// labels each showcase without hard-coding plan ids.
const INTEREST_KEYWORDS: Record<string, string[]> = {
  food: ['food', 'foodie', 'culinary', 'dining', 'gastro', 'eat'],
  outdoors: ['outdoor', 'nature', 'adventure', 'hike', 'beach', 'park'],
  coffee: ['coffee', 'cafe', 'café', 'espresso'],
  culture: ['culture', 'cultural', 'art', 'museum', 'history', 'historic', 'heritage'],
  nightlife: ['nightlife', 'night', 'bar', 'club', 'cocktail'],
  wellness: ['wellness', 'spa', 'relax', 'yoga', 'retreat'],
  shopping: ['shopping', 'boutique', 'market', 'shop'],
};

/**
 * Pick the showcase plan that best matches the user's onboarding interests.
 * Scores each plan by how many interest keywords appear in its text, then:
 * no plans → null; no interests / no keyword signal / a tie for the top →
 * `plans[0]` (deterministic); otherwise the unique highest-scoring plan.
 */
export function pickShowcasePlanForInterests(
  plans: Plan[],
  interests: string[] | undefined,
): Plan | null {
  if (plans.length === 0) return null;
  const first = plans[0];
  if (!interests || interests.length === 0) return first;

  const keywords = interests.flatMap((id) => INTEREST_KEYWORDS[id] ?? []);
  if (keywords.length === 0) return first;

  let bestScore = 0;
  let bestPlan: Plan | null = null;
  let tie = false;
  for (const plan of plans) {
    const haystack = [plan.name, plan.description, plan.type, JSON.stringify(plan.tripContext ?? '')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const score = keywords.reduce((acc, kw) => (haystack.includes(kw) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestPlan = plan;
      tie = false;
    } else if (score === bestScore && score > 0) {
      tie = true;
    }
  }
  // Nothing matched, or two plans tied for the top → deterministic default.
  if (bestScore === 0 || tie || !bestPlan) return first;
  return bestPlan;
}

interface OnboardingPreviewScreenProps {
  city: string | null;
  /**
   * Secondary "not now" path: continue WITHOUT saving. Preserves the pre-hook
   * behaviour (advance to the paywall step / complete onboarding).
   */
  onCreatePlan: () => void;
  /**
   * Guest tapped "Save this plan": the intent is staged, the orchestrator must
   * present registration. Replayed after a successful login (`clone-plan-store`).
   */
  onRequestSignup: () => void;
  /**
   * An already-authenticated user saved directly (clone succeeded, or failed
   * gracefully): complete onboarding. The app shell then lands on the cloned
   * plan via the staged landing id.
   */
  onSaved: () => void;
}

interface PreviewStop {
  name: string;
  category: string | null;
}

export function OnboardingPreviewScreen({
  city,
  onCreatePlan,
  onRequestSignup,
  onSaved,
}: OnboardingPreviewScreenProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { presentGate } = useGateHandler();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stops, setStops] = useState<PreviewStop[]>([]);
  const [heroPhoto, setHeroPhoto] = useState<{ url: string; source: 'google' | 'external' | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const listRes = await getShowcasePlans(city ?? undefined, controller.signal);
        if (controller.signal.aborted) return;
        const chosen = pickShowcasePlanForInterests(
          listRes.data?.plans ?? [],
          getOnboardingPrefsSync().interests,
        );
        if (!chosen) {
          setLoading(false);
          return;
        }
        setPlan(chosen);
        const detailRes = await getPlanDetail(chosen.id, controller.signal);
        if (controller.signal.aborted) return;
        const flat = (detailRes.data?.days ?? []).flatMap((d) => d.stops);
        // The list DTO carries no photo; the detail's stops do. Use the first
        // available so the cover is a real photo, not always the gradient.
        const photoStop = flat.find((s) => s.place?.photos?.[0]);
        const photoUrl = photoStop?.place?.photos?.[0];
        if (photoUrl) {
          setHeroPhoto({ url: photoUrl, source: photoStop?.place?.photoSource ?? null });
        }
        setStops(
          flat.slice(0, 3).map((s) => ({
            name: s.place?.name ?? '',
            category: s.place?.category ?? chosen.category ?? null,
          })),
        );
      } catch (err) {
        if (!controller.signal.aborted) logger.warn('onboarding: preview fetch failed', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [city]);

  const cityLabel = city ?? t('onboarding.previewYourCity');
  const heroCategory = (plan?.category as Category | undefined) ?? 'Culture';

  // "Save this plan": the primary hook. A guest must register first (intent
  // staged + replayed post-login by `clone-plan-store`); an authenticated user
  // clones directly. On success the cloned plan id is staged so the app shell
  // lands on it. Failures never strand the user — a saved-cap 403 shows the Plus
  // upsell, anything else logs and completes onboarding (lands home).
  const handleSavePlan = async () => {
    if (!plan || saving) return;
    track({ event: 'onboarding_save_plan_tapped' });

    if (!isAuthenticated) {
      setPendingClonePlan(plan.id);
      onRequestSignup();
      return;
    }

    setSaving(true);
    try {
      const res = await clonePlan(plan.id);
      if (res.data?.id) {
        track({ event: 'onboarding_plan_saved', viaSignup: false });
        setPendingCloneLanding(res.data.id);
        onSaved();
        return;
      }
      const action = mapGateError(res.status, res.errorBody);
      if (action.type === 'upsell' && action.code === 'saved_plans_limit_reached') {
        presentGate(action);
        return;
      }
      if (action.type === 'signup_required') {
        // A stale token expired mid-flight: stage the intent and steer to signup.
        setPendingClonePlan(plan.id);
        onRequestSignup();
        return;
      }
      // Network / other: don't leave the user stuck — complete onboarding (home).
      logger.warn('onboarding: save plan failed', { status: res.status });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>{t('onboarding.previewEyebrow')}</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.sunsetOrange} />
            <Text style={styles.loadingText}>{t('onboarding.previewLoading')}</Text>
          </View>
        ) : plan ? (
          <View style={styles.card}>
            <PhotoHero
              imageUrl={heroPhoto?.url}
              photoSource={heroPhoto?.source ?? null}
              fallbackCategory={heroCategory}
              height={200}
            />
            <View style={styles.cardBody}>
              <Text style={styles.planName}>{plan.name}</Text>
              {plan.description ? (
                <Text style={styles.planDesc} numberOfLines={2}>
                  {plan.description}
                </Text>
              ) : null}
              {stops.map((stop, i) => (
                <View key={`${stop.name}-${i}`} style={styles.stopRow}>
                  <View style={styles.stopDot}>
                    <Text style={styles.stopIndex}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stopName} numberOfLines={1}>
                    {stop.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <PhotoHero fallbackCategory={heroCategory} height={200} />
            <View style={styles.cardBody}>
              <Text style={styles.planName}>{t('onboarding.previewGenericTitle', { city: cityLabel })}</Text>
              <Text style={styles.planDesc}>{t('onboarding.previewGenericSubtitle')}</Text>
              <View style={styles.genericRow}>
                <Ionicons name="sparkles" size={16} color={colors.sunsetOrange} />
                <Text style={styles.genericHint}>{t('onboarding.previewGenericHint')}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, (saving || !plan) && styles.primaryBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleSavePlan}
          disabled={saving || !plan}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !plan, busy: saving }}
          accessibilityLabel={t('onboarding.savePlan')}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('onboarding.savePlan')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.7}
          onPress={onCreatePlan}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.saveNotNow')}
        >
          <Text style={styles.secondaryBtnText}>{t('onboarding.saveNotNow')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  planName: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
  },
  planDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stopDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.sunsetOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndex: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
  stopName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textMain,
  },
  genericRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  genericHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.electricBlue,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: '#FFFFFF' },
  secondaryBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
