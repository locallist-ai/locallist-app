import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle, PrimaryButton } from '../ui/design-system';
import { createImportPlan } from '../../lib/api';
import { mapGateError, type GateAction } from '../../lib/gate-errors';
import { track, type ImportPlatform } from '../../lib/analytics';
import { maxDaysForTier, PLUS_MAX_DAYS, FREE_MAX_DAYS } from '../home/constants';
import { importErrorKey, extractCode, sanitizeHandle } from '../../lib/import/import-errors';
import { CandidateRow } from './CandidateRow';
import type { ImportCandidate } from '../../lib/types';

// Import results — the extracted candidates + selection + tier-aware day picker
// + optional plan name + create footer. Owns its own selection/create state so
// the screen orchestrator stays thin; the create errors surface inline here.

export interface ImportResultsProps {
  candidates: ImportCandidate[];
  city: string | null;
  isPro: boolean;
  platform: ImportPlatform;
  creatorHandle: string;
  presentGate: (action: GateAction, opts?: { onDismiss?: () => void }) => unknown;
  paddingBottom?: number;
}

export const ImportResults: React.FC<ImportResultsProps> = ({
  candidates,
  city,
  isPro,
  platform,
  creatorHandle,
  presentGate,
  paddingBottom = 0,
}) => {
  const { t } = useTranslation();
  const td = t as unknown as (key: string) => string;

  const matched = candidates.filter((c) => !!c.matchedPlaceId);
  // Matched candidates start pre-selected.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(matched.map((c) => c.matchedPlaceId as string)),
  );
  const [selectedDays, setSelectedDays] = useState(1);
  const [planName, setPlanName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const maxDays = maxDaysForTier(isPro);

  const toggleSelect = useCallback((placeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }, []);

  const handleSelectDays = useCallback(
    (d: number) => {
      if (d > maxDays) return;
      setSelectedDays(d);
    },
    [maxDays],
  );

  const handleLockedDays = useCallback(() => {
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

  const handleCreate = useCallback(async () => {
    if (creating) return;
    if (selectedIds.size === 0) {
      Alert.alert(t('import.selectAtLeastOne'), '', [{ text: t('common.ok') }]);
      return;
    }
    if (!city) {
      setErrorKey('import.noCity');
      return;
    }
    setCreating(true);
    setErrorKey(null);
    const placeIds = Array.from(selectedIds);
    const res = await createImportPlan({
      city,
      days: selectedDays,
      placeIds,
      planName: planName.trim() ? planName.trim() : undefined,
      platform,
      // Attribution carried through to the created plan for third-party clips.
      creatorHandle: platform !== 'self' ? sanitizeHandle(creatorHandle) || undefined : undefined,
    });
    if (!mountedRef.current) return;
    setCreating(false);

    if (res.data) {
      track({ event: 'import_plan_created', places: placeIds.length });
      router.replace(`/plan/${res.data.id}`);
      return;
    }

    const action = mapGateError(res.status, res.errorBody);
    if (action.type === 'signup_required') {
      track({ event: 'import_gate_hit', reason: 'signup' });
      presentGate(action);
      return;
    }
    if (action.type === 'upsell') {
      track({ event: 'import_gate_hit', reason: 'plus' });
      presentGate(action);
      return;
    }
    if (res.status === 429) track({ event: 'import_gate_hit', reason: 'limit' });
    setErrorKey(importErrorKey(res.status, extractCode(res.errorBody)));
  }, [creating, selectedIds, city, selectedDays, planName, platform, creatorHandle, t, presentGate]);

  const noneSelected = selectedIds.size === 0;

  return (
    <>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <EditorialTitle text={t('import.resultsTitle')} size="sm" align="left" style={s.title} />
        <StepSubtitle text={t('import.resultsSubtitle')} align="left" />
        <Text style={s.matchedCount}>
          {t('import.matchedCount', { matched: matched.length, total: candidates.length })}
        </Text>

        <View style={s.candidateList}>
          {candidates.map((c, idx) => {
            const matchedId = c.matchedPlaceId ?? null;
            const selected = matchedId ? selectedIds.has(matchedId) : false;
            return (
              <CandidateRow
                key={`${c.name}-${idx}`}
                candidate={c}
                index={idx}
                selected={selected}
                onToggle={toggleSelect}
              />
            );
          })}
        </View>

        {/* Duration picker (tier-aware, shared wizard pill token). */}
        <Text style={s.sectionLabel}>{t('import.daysLabel')}</Text>
        <View style={s.dayPills}>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => {
            const on = selectedDays === d;
            return (
              <TouchableOpacity
                key={d}
                testID={`import-day-${d}`}
                onPress={() => handleSelectDays(d)}
                style={[s.pill, on && s.pillOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('common.dayCount', { count: d })}
              >
                <Text style={[s.pillText, on && s.pillTextOn]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
          {!isPro && (
            <TouchableOpacity
              testID="import-day-locked"
              onPress={handleLockedDays}
              style={[s.pill, s.pillLocked]}
              accessibilityRole="button"
              accessibilityLabel={t('import.daysPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
            >
              <Ionicons name="lock-closed" size={13} color={colors.sunsetOrange} style={s.lockIcon} />
              <Text style={s.pillLockedText} numberOfLines={1}>
                {t('import.daysPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Optional plan name. */}
        <View style={s.nameLabelRow}>
          <Text style={s.sectionLabel}>{t('import.planNameLabel')}</Text>
          <Text style={s.optionalLabel}>{t('import.planNameOptional')}</Text>
        </View>
        <TextInput
          style={s.nameInput}
          value={planName}
          onChangeText={setPlanName}
          placeholder={t('import.planNamePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          maxLength={80}
          returnKeyType="done"
        />

        {errorKey ? <Text style={s.errorBannerText}>{td(errorKey)}</Text> : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: paddingBottom + spacing.md }]}>
        <PrimaryButton
          label={t('import.create')}
          onPress={handleCreate}
          loading={creating}
          disabled={noneSelected}
          testID="import-create"
        />
        {/* Why the button is disabled when nothing (or nothing matched) is selected. */}
        {noneSelected ? <Text style={s.footerHintText}>{t('import.selectAtLeastOne')}</Text> : null}
      </View>
    </>
  );
};

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  matchedCount: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  candidateList: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMain,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  dayPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Shared wizard pill token (matches the day pills in the manual builder).
  pill: {
    minWidth: 52,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  pillOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  pillTextOn: {
    color: '#FFFFFF',
  },
  pillLocked: {
    minWidth: 150,
    backgroundColor: colors.sunsetOrangeLight,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  pillLockedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
  lockIcon: {
    marginRight: 6,
  },
  nameLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  optionalLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  nameInput: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerHintText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
