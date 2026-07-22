import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts, colors } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { FREE_MAX_DAYS, PLUS_MAX_DAYS, maxDaysForTier } from './constants';

// ── Types ──

interface DurationStepProps {
  /** Currently selected day count (parsed from selections[0]), or null. */
  selectedDays: number | null;
  /** Called when the user picks an allowed day count. */
  onSelectDays: (days: number) => void;
  /** Continue / Skip to the next wizard step. */
  onContinue: () => void;
}

// ── Component ──

/**
 * Duration step for the AI wizard. Tier-aware: free accounts can pick up to
 * {@link FREE_MAX_DAYS} days; Plus unlocks up to {@link PLUS_MAX_DAYS}. Free
 * users see the extra days as a single locked affordance that fires the
 * `duration_requires_plus` upsell (mirrors the backend gate), so tapping "more"
 * never silently no-ops.
 */
export const DurationStep: React.FC<DurationStepProps> = ({
  selectedDays,
  onSelectDays,
  onContinue,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isPro } = useAuth();
  const { presentGate } = useGateHandler();

  const maxDays = maxDaysForTier(isPro);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  const handleLockedPress = useCallback(() => {
    presentGate({
      type: 'upsell',
      code: 'duration_requires_plus',
      used: null,
      limit: null,
      resetsAt: null,
      requestedDays: null,
      maxDays: FREE_MAX_DAYS,
      plusMaxDays: PLUS_MAX_DAYS,
    });
  }, [presentGate]);

  return (
    <View style={styles.container}>
      <EditorialTitle
        text={t('wizard.step1Title')}
        size="md"
        color="#FFFFFF"
        withShadow
        style={styles.titleSpacing}
      />
      <StepSubtitle
        text={t('wizard.step1Subtitle')}
        size="md"
        color="rgba(255, 255, 255, 0.7)"
        withShadow
        style={styles.subtitleSpacing}
      />

      <ScrollView
        style={styles.pillScroll}
        contentContainerStyle={styles.pillWrap}
        showsVerticalScrollIndicator={false}
      >
        {days.map((d) => {
          const selected = selectedDays === d;
          return (
            <TouchableOpacity
              key={d}
              testID={`duration-pill-${d}`}
              activeOpacity={0.85}
              onPress={() => onSelectDays(d)}
              style={[styles.pill, selected && styles.pillSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t('common.dayCount', { count: d })}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{d}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Free tier: locked affordance for the Plus-only range (4–14). */}
        {!isPro && (
          <TouchableOpacity
            testID="duration-plus-locked"
            activeOpacity={0.85}
            onPress={handleLockedPress}
            style={[styles.pill, styles.pillLocked]}
            accessibilityRole="button"
            accessibilityLabel={t('gate.durationPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
          >
            <Ionicons name="lock-closed" size={14} color="#FFFFFF" style={styles.lockIcon} />
            <Text style={styles.pillLockedText} numberOfLines={1}>
              {t('gate.durationPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[styles.continueWrapper, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onContinue}
          style={styles.continueButton}
          accessibilityLabel={selectedDays ? t('wizard.interestContinue') : t('wizard.skip')}
          accessibilityRole="button"
        >
          <BlurView intensity={60} tint="light" style={styles.continueBlur}>
            <Text style={styles.continueText}>
              {selectedDays ? t('wizard.interestContinue') : t('wizard.skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSpacing: {
    marginBottom: 8,
  },
  subtitleSpacing: {
    marginBottom: 24,
  },
  pillScroll: {
    flexGrow: 0,
    maxHeight: 240,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  pill: {
    minWidth: 56,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pillSelected: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
  pillLocked: {
    minWidth: 160,
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  lockIcon: {
    marginRight: 6,
  },
  pillLockedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  continueWrapper: {
    marginTop: 20,
  },
  continueButton: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBlur: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  continueText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
