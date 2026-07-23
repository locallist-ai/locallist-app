import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { ChoiceChip, EditorialTitle, StepSubtitle } from '../ui/design-system';
import { INTEREST_OPTIONS, BUDGET_OPTIONS, type StepOption } from '../home/constants';
import { useTaxonomy, INTEREST_TO_CATEGORY } from '../home/useTaxonomy';
import { getOnboardingPrefsSync } from '../../lib/onboarding-store';

// Onboarding screen 3 — tastes (skippable). Multi-select interests (driven by
// the live taxonomy categories, rendered with the branded interest chips) plus a
// single-select budget tier. Selections are handed to the orchestrator, which
// persists them to `onboarding_prefs`. "Skip" advances with nothing captured.

interface OnboardingTasteScreenProps {
  onContinue: (prefs: { interests: string[]; budget: string | null }) => void;
  onSkip: () => void;
}

/**
 * Interest chips, ordered by the live taxonomy categories and enriched with the
 * branded label/icon from INTEREST_OPTIONS. Categories without a known chip are
 * dropped; if the taxonomy is empty we fall back to the full static list.
 */
function useInterestChips(): StepOption[] {
  const taxonomy = useTaxonomy();
  return useMemo(() => {
    const byCategory = new Map<string, StepOption>();
    for (const opt of INTEREST_OPTIONS) {
      const category = INTEREST_TO_CATEGORY[opt.id];
      if (category) byCategory.set(category, opt);
    }
    const fromTaxonomy = taxonomy.categories
      .map((cat) => byCategory.get(cat))
      .filter((opt): opt is StepOption => !!opt);
    return fromTaxonomy.length > 0 ? fromTaxonomy : INTEREST_OPTIONS;
  }, [taxonomy]);
}

export function OnboardingTasteScreen({ onContinue, onSkip }: OnboardingTasteScreenProps) {
  const { t } = useTranslation();
  const interestChips = useInterestChips();
  // Pre-fill from prefs already persisted this session. The screen mounts
  // conditionally (`stepIndex === 2`), so revisiting it from the preview remounts
  // it fresh; without seeding, tapping Continue again would overwrite captured
  // interests with `[]`. Seeding keeps back-navigation non-destructive (matches the
  // budget's condition-preserving spread in the orchestrator).
  const [interests, setInterests] = useState<string[]>(
    () => getOnboardingPrefsSync().interests ?? [],
  );
  const [budget, setBudget] = useState<string | null>(
    () => getOnboardingPrefsSync().budget ?? null,
  );

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <EditorialTitle text={t('onboarding.tasteTitle')} size="md" color={colors.paperWhite} withShadow />
        <StepSubtitle text={t('onboarding.tasteSubtitle')} color={colors.paperWhite} style={styles.subtitle} />

        {interestChips.map((opt, index) => (
          <ChoiceChip
            key={opt.id}
            label={t(opt.labelKey)}
            emoji={opt.emoji}
            iconName={opt.iconName}
            selected={interests.includes(opt.id)}
            onPress={() => toggleInterest(opt.id)}
            index={index}
            testID={`interest-${opt.id}`}
          />
        ))}

        <Text style={styles.sectionHeading}>{t('onboarding.tasteBudgetTitle')}</Text>
        {BUDGET_OPTIONS.map((opt, index) => (
          <ChoiceChip
            key={opt.id}
            label={t(opt.labelKey)}
            emoji={opt.emoji}
            iconName={opt.iconName}
            selected={budget === opt.id}
            onPress={() => setBudget((prev) => (prev === opt.id ? null : opt.id))}
            index={index}
            testID={`budget-${opt.id}`}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => onContinue({ interests, budget })}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.continue')}
        >
          <Text style={styles.primaryBtnText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          activeOpacity={0.7}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.skip')}
        >
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
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
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.paperWhite,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.electricBlue,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: '#FFFFFF' },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.paperWhite },
});
