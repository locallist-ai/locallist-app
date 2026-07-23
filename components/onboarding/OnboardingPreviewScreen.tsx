import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { getShowcasePlans, getPlanDetail } from '../../lib/api';
import { logger } from '../../lib/logger';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import type { Plan } from '../../lib/types';

// Onboarding screen 4 — value preview. Shows a REAL curated plan for the chosen
// city (PhotoHero cover + the first 2-3 stops) so the payoff is concrete before
// the user commits. Falls back to a generic category-gradient card when the city
// has no showcase plan (never fabricates photos). The CTA finishes onboarding.

interface OnboardingPreviewScreenProps {
  city: string | null;
  onCreatePlan: () => void;
}

interface PreviewStop {
  name: string;
  category: string | null;
}

export function OnboardingPreviewScreen({ city, onCreatePlan }: OnboardingPreviewScreenProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stops, setStops] = useState<PreviewStop[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const listRes = await getShowcasePlans(city ?? undefined, controller.signal);
        if (controller.signal.aborted) return;
        const first = listRes.data?.plans?.[0];
        if (!first) {
          setLoading(false);
          return;
        }
        setPlan(first);
        const detailRes = await getPlanDetail(first.id, controller.signal);
        if (controller.signal.aborted) return;
        const flat = (detailRes.data?.days ?? []).flatMap((d) => d.stops);
        setStops(
          flat.slice(0, 3).map((s) => ({
            name: s.place?.name ?? '',
            category: s.place?.category ?? first.category ?? null,
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
            <ActivityIndicator color={colors.paperWhite} />
            <Text style={styles.loadingText}>{t('onboarding.previewLoading')}</Text>
          </View>
        ) : plan ? (
          <View style={styles.card}>
            <PhotoHero
              imageUrl={plan.image ?? undefined}
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
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={onCreatePlan}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.createPlan')}
        >
          <Text style={styles.primaryBtnText}>{t('onboarding.createPlan')}</Text>
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
    color: colors.paperWhite,
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
    color: colors.paperWhite,
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
  },
  primaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: '#FFFFFF' },
});
