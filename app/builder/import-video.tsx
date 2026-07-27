/**
 * Import a plan from your OWN travel video (F2 T5).
 *
 * Flow: pick a video from the library → client-validate (size/duration/format)
 * → multipart upload with progress (`importVideo`) → the backend extracts places
 * and matches them to LocalList → the user picks the matched places, a duration
 * and an optional name → `createImportPlan` builds a private plan and we open it.
 *
 * v1 is SELF content only: `platform` is always 'self' from the app, so there is
 * no third-party-URL UI here. The picker rides a REQUIRE-GUARDED native module
 * (`lib/import/native-picker`): on any binary without expo-image-picker the flow
 * degrades to an "update needed" notice, never a startup crash.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { mapGateError } from '../../lib/gate-errors';
import { track, type ImportPlatform } from '../../lib/analytics';
import { logger } from '../../lib/logger';
import { getAccessToken, importVideo, createImportPlan } from '../../lib/api';
import { pickVideo, isImagePickerAvailable, type PickedVideo } from '../../lib/import/native-picker';
import { validatePickedVideo, resolveUploadMime, type VideoValidationError } from '../../lib/import/validate';
import { maxDaysForTier, PLUS_MAX_DAYS, FREE_MAX_DAYS } from '../../components/home/constants';
import type { ImportCandidate } from '../../lib/types';

type Phase = 'idle' | 'uploading' | 'analyzing' | 'results';

/**
 * Attribution platform (`ImportPlatform`). The video is ALWAYS a file the user
 * picked from their own library — `platform` is metadata that tags where the clip
 * came from, never a download source (we never touch TikTok/Instagram). `self`
 * (own content) is the default and the only one that needs no disclaimer; the
 * rest are gated server-side behind `Import:ThirdPartyEnabled`.
 */
const PLATFORM_OPTIONS: { value: ImportPlatform; labelKey: string }[] = [
  { value: 'self', labelKey: 'import.platformSelf' },
  { value: 'tiktok', labelKey: 'import.platformTiktok' },
  { value: 'instagram', labelKey: 'import.platformInstagram' },
  { value: 'other', labelKey: 'import.platformOther' },
];

/** The backend validates the handle with a strict regex; we only keep the client
 *  input sane (trim + hard cap) so we never send obvious garbage. */
const MAX_HANDLE = 64;
function sanitizeHandle(raw: string): string {
  return raw.trim().slice(0, MAX_HANDLE);
}

/** Backend error code → i18n key. Falls back on status, then generic. */
function importErrorKey(status: number, code: string | null): string {
  switch (code) {
    case 'import_unsupported_format':
      return 'import.errorUnsupported';
    case 'import_too_large':
      return 'import.errorTooLarge';
    case 'import_video_too_long':
      return 'import.errorTooLong';
    case 'import_missing_file':
      return 'import.errorMissingFile';
    case 'import_invalid_request':
      return 'import.errorInvalidRequest';
    case 'no_places_found':
      return 'import.errorNoPlaces';
    case 'import_unavailable':
      return 'import.errorUnavailable';
    case 'import_limit_reached':
      return 'import.errorLimit';
    case 'third_party_import_disabled':
      return 'import.thirdPartyDisabled';
    case 'import_invalid_places':
      return 'import.errorInvalidPlaces';
    case 'import_too_many_places':
      return 'import.errorTooManyPlaces';
    default:
      break;
  }
  if (status === 429) return 'import.errorLimit';
  if (status === 503) return 'import.errorUnavailable';
  return 'import.errorGeneric';
}

const VALIDATION_KEY: Record<VideoValidationError, string> = {
  too_large: 'import.errorTooLarge',
  too_long: 'import.errorTooLong',
  unsupported_format: 'import.errorUnsupported',
};

function extractCode(errorBody: unknown): string | null {
  const code = (errorBody as { error?: unknown } | null)?.error;
  return typeof code === 'string' ? code : null;
}

export default function ImportVideoScreen() {
  const { t } = useTranslation();
  // Loosely-typed alias for keys computed at runtime (error/badge keys); the
  // strongly-typed `t` only accepts literal keys.
  const td = t as unknown as (key: string, opts?: Record<string, unknown>) => string;
  const insets = useSafeAreaInsets();
  const { isPro } = useAuth();
  const { presentGate } = useGateHandler();

  const [phase, setPhase] = useState<Phase>('idle');
  // Attribution: where the (self-uploaded) video came from. `self` = own content.
  const [platform, setPlatform] = useState<ImportPlatform>('self');
  const [creatorHandle, setCreatorHandle] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState(1);
  const [planName, setPlanName] = useState('');
  const [creating, setCreating] = useState(false);
  // The last upload failure is worth a retry (network drop / timeout / 503):
  // gates and validation errors are not, re-firing them would just repeat.
  const [uploadRetryable, setUploadRetryable] = useState(false);

  // Synchronous re-entrancy guard: the token read below yields, so two taps in
  // the same frame must not both open the picker / fire two uploads.
  const busyRef = useRef(false);
  // Last picked asset, so a retryable failure (network / timeout / 503) can
  // re-upload without making the user re-pick.
  const lastAssetRef = useRef<PickedVideo | null>(null);
  // Abort the in-flight upload when the screen unmounts (iOS swipe-back during
  // uploading): never keep pushing up to 150 MB for a dead screen, and never
  // setState on an unmounted component.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const maxDays = maxDaysForTier(isPro);

  const doUpload = useCallback(
    async (asset: PickedVideo) => {
      lastAssetRef.current = asset;
      const controller = new AbortController();
      abortRef.current = controller;
      setErrorKey(null);
      setUploadRetryable(false);
      setProgress(0);
      setPhase('uploading');

      // Handle is attribution only, and only for third-party clips.
      const handle = platform !== 'self' ? sanitizeHandle(creatorHandle) || undefined : undefined;
      const res = await importVideo({
        fileUri: asset.uri,
        fileName: asset.fileName,
        mimeType: resolveUploadMime(asset),
        platform,
        creatorHandle: handle,
        signal: controller.signal,
        onProgress: (fraction) => {
          if (!mountedRef.current) return;
          setProgress(fraction);
          if (fraction >= 0.999) setPhase('analyzing');
        },
      });

      // Aborted (unmount) or unmounted while awaiting: drop the result, no setState.
      if (controller.signal.aborted || !mountedRef.current) return;

      if (res.data && res.data.candidates && res.data.candidates.length > 0) {
        const list = res.data.candidates;
        const matched = list.filter((c) => !!c.matchedPlaceId);
        setCandidates(list);
        setCity(res.data.city ?? null);
        // Matched candidates start pre-selected.
        setSelectedIds(new Set(matched.map((c) => c.matchedPlaceId as string)));
        setPhase('results');
        // `platform` is safe to log (attribution); the handle is NOT (PII).
        track({ event: 'import_video_uploaded', candidates: list.length, matched: matched.length, platform });
        return;
      }

      // Error (or an empty 200, treated as "no places"). Route gates to their
      // Alert; surface everything else as an inline banner back on the idle screen.
      const action = mapGateError(res.status, res.errorBody);
      if (action.type === 'signup_required') {
        track({ event: 'import_gate_hit', reason: 'signup' });
        presentGate(action);
        setPhase('idle');
        return;
      }
      if (action.type === 'upsell') {
        track({ event: 'import_gate_hit', reason: 'plus' });
        presentGate(action);
        setPhase('idle');
        return;
      }

      const code = extractCode(res.errorBody);
      if (res.status === 429 || code === 'import_limit_reached') {
        track({ event: 'import_gate_hit', reason: 'limit' });
      }
      const key = res.data ? 'import.errorNoPlaces' : importErrorKey(res.status, code);
      setErrorKey(key);
      // Network drop / timeout (status 0) and 503 are transient: offer a retry
      // that reuses the picked asset. Everything else needs a different video
      // or a different tier, retrying the same upload would just repeat it.
      setUploadRetryable(
        !res.data && (res.status === 0 || res.status === 503 || code === 'import_unavailable'),
      );
      setPhase('idle');
    },
    [presentGate, platform, creatorHandle],
  );

  const handleChooseVideo = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      track({ event: 'import_video_started', platform });
      setErrorKey(null);

      // Guarded native module: no expo-image-picker in this binary → update notice.
      if (!isImagePickerAvailable()) {
        Alert.alert(t('import.updateNeededTitle'), t('import.updateNeededBody'), [{ text: t('common.ok') }]);
        return;
      }

      // Guest gate: no token → prompt signup before opening the picker (mirrors
      // the wizard: gate on TOKEN PRESENCE, never on a possibly-stale `user`).
      const token = await getAccessToken();
      if (!token) {
        track({ event: 'import_gate_hit', reason: 'signup' });
        presentGate({ type: 'signup_required' });
        return;
      }

      const picked = await pickVideo();
      if (picked.status === 'unavailable') {
        Alert.alert(t('import.updateNeededTitle'), t('import.updateNeededBody'), [{ text: t('common.ok') }]);
        return;
      }
      if (picked.status === 'denied') {
        Alert.alert(t('import.permissionDeniedTitle'), t('import.permissionDeniedBody'), [{ text: t('common.ok') }]);
        return;
      }
      if (picked.status === 'canceled') return;

      // Client validation BEFORE the network: reject known violations for free.
      const invalid = validatePickedVideo(picked.asset);
      if (invalid) {
        setErrorKey(VALIDATION_KEY[invalid]);
        return;
      }

      await doUpload(picked.asset);
    } catch (err) {
      logger.error('import: choose/upload failed', err);
      setErrorKey('import.errorGeneric');
      setPhase('idle');
    } finally {
      busyRef.current = false;
    }
  }, [t, presentGate, doUpload, platform]);

  const handleRetryUpload = useCallback(() => {
    const asset = lastAssetRef.current;
    if (asset) void doUpload(asset);
  }, [doUpload]);

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

  // ── Render helpers ──

  const renderClose = () => (
    <TouchableOpacity
      style={s.closeButton}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
    >
      <Ionicons name="close" size={24} color={colors.textMain} />
    </TouchableOpacity>
  );

  // ── Uploading / analyzing ──
  if (phase === 'uploading' || phase === 'analyzing') {
    const percent = Math.round(progress * 100);
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.centerContent}>
          <ActivityIndicator size="large" color={colors.sunsetOrange} />
          <Text style={s.progressLabel}>
            {phase === 'uploading' ? t('import.uploadingPercent', { percent }) : t('import.analyzing')}
          </Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${phase === 'analyzing' ? 100 : percent}%` }]} />
          </View>
        </View>
      </View>
    );
  }

  // ── Results ──
  if (phase === 'results') {
    const matched = candidates.filter((c) => !!c.matchedPlaceId);
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {renderClose()}
        <ScrollView
          contentContainerStyle={s.resultsScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>{t('import.resultsTitle')}</Text>
          <Text style={s.subtitle}>{t('import.resultsSubtitle')}</Text>
          <Text style={s.matchedCount}>
            {t('import.matchedCount', { matched: matched.length, total: candidates.length })}
          </Text>

          <View style={s.candidateList}>
            {candidates.map((c, idx) => {
              const matchedId = c.matchedPlaceId ?? null;
              const isMatched = !!matchedId;
              const selected = matchedId ? selectedIds.has(matchedId) : false;
              const badgeKey =
                c.matchConfidence === 'high'
                  ? 'import.matchedBadgeHigh'
                  : c.matchConfidence === 'medium'
                    ? 'import.matchedBadgeMedium'
                    : null;
              return (
                <TouchableOpacity
                  key={`${c.name}-${idx}`}
                  activeOpacity={isMatched ? 0.8 : 1}
                  disabled={!isMatched}
                  onPress={() => matchedId && toggleSelect(matchedId)}
                  testID={`candidate-${idx}`}
                  accessibilityRole={isMatched ? 'checkbox' : 'text'}
                  accessibilityState={{ checked: selected, disabled: !isMatched }}
                  style={[s.candidateRow, !isMatched && s.candidateRowDisabled]}
                >
                  <View style={[s.checkBubble, selected && s.checkBubbleOn, !isMatched && s.checkBubbleOff]}>
                    {isMatched ? (
                      <MaterialCommunityIcons
                        name={selected ? 'check' : 'plus'}
                        size={18}
                        color={selected ? '#FFFFFF' : colors.sunsetOrange}
                      />
                    ) : (
                      <MaterialCommunityIcons name="map-marker-off-outline" size={18} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={s.candidateText}>
                    <Text style={[s.candidateName, !isMatched && s.candidateNameMuted]} numberOfLines={1}>
                      {isMatched ? c.matchedPlaceName ?? c.name : c.name}
                    </Text>
                    {isMatched && badgeKey ? (
                      <View style={s.confidenceBadge}>
                        <Text style={s.confidenceBadgeText}>{td(badgeKey)}</Text>
                      </View>
                    ) : !isMatched ? (
                      <Text style={s.notOnLocalList}>{t('import.notOnLocalList')}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration picker (tier-aware, mirrors DurationStep). */}
          <Text style={s.sectionLabel}>{t('import.daysLabel')}</Text>
          <View style={s.dayPills}>
            {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => {
              const on = selectedDays === d;
              return (
                <TouchableOpacity
                  key={d}
                  testID={`import-day-${d}`}
                  onPress={() => handleSelectDays(d)}
                  style={[s.dayPill, on && s.dayPillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t('common.dayCount', { count: d })}
                >
                  <Text style={[s.dayPillText, on && s.dayPillTextOn]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
            {!isPro && (
              <TouchableOpacity
                testID="import-day-locked"
                onPress={handleLockedDays}
                style={[s.dayPill, s.dayPillLocked]}
                accessibilityRole="button"
                accessibilityLabel={t('import.daysPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
              >
                <Ionicons name="lock-closed" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={s.dayPillLockedText} numberOfLines={1}>
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

        <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            testID="import-create"
            activeOpacity={0.85}
            disabled={creating || selectedIds.size === 0}
            onPress={handleCreate}
            style={[s.primaryButton, (creating || selectedIds.size === 0) && s.primaryButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t('import.create')}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.primaryButtonText}>{t('import.create')}</Text>
            )}
          </TouchableOpacity>
          {/* Why the button is disabled when nothing (or nothing matched) is selected. */}
          {selectedIds.size === 0 ? (
            <Text style={s.footerHintText}>{t('import.selectAtLeastOne')}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Idle ──
  const retryable = uploadRetryable && lastAssetRef.current !== null;
  const isThirdParty = platform !== 'self';
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {renderClose()}
      <ScrollView
        contentContainerStyle={s.idleContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.iconBubble}>
          <MaterialCommunityIcons name="movie-open-outline" size={44} color={colors.sunsetOrange} />
        </View>
        <Text style={s.title}>{t('import.title')}</Text>
        <Text style={[s.subtitle, s.idleIntro]}>{t('import.intro')}</Text>

        {/* Attribution: where the video came from (self = own content, default). */}
        <Text style={s.platformLabel}>{t('import.platformLabel')}</Text>
        <View style={s.platformRow}>
          {PLATFORM_OPTIONS.map((opt) => {
            const on = platform === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                testID={`import-platform-${opt.value}`}
                onPress={() => setPlatform(opt.value)}
                style={[s.platformPill, on && s.platformPillOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(opt.labelKey as 'import.platformSelf')}
              >
                <Text style={[s.platformPillText, on && s.platformPillTextOn]}>
                  {t(opt.labelKey as 'import.platformSelf')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isThirdParty ? (
          <>
            {/* Prominent, unambiguous legal notice — only for third-party clips. */}
            <View style={s.disclaimerBox} testID="import-disclaimer">
              <MaterialCommunityIcons
                name="alert-outline"
                size={20}
                color={colors.sunsetOrange}
                style={{ marginTop: 1 }}
              />
              <Text style={s.disclaimerText}>{t('import.disclaimer')}</Text>
            </View>

            {/* Optional creator attribution (not logged — treated as PII). */}
            <Text style={s.platformLabel}>{t('import.creatorHandleLabel')}</Text>
            <TextInput
              testID="import-creator-handle"
              style={s.handleInput}
              value={creatorHandle}
              onChangeText={setCreatorHandle}
              placeholder={t('import.creatorHandlePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_HANDLE}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
          </>
        ) : null}

        {errorKey ? (
          <View style={s.errorBox}>
            <Text style={s.errorBannerText}>{td(errorKey)}</Text>
            {retryable ? (
              <TouchableOpacity onPress={handleRetryUpload} accessibilityRole="button" testID="import-retry">
                <Text style={s.retryText}>{t('import.retry')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          testID="import-choose"
          activeOpacity={0.85}
          onPress={handleChooseVideo}
          style={s.primaryButton}
          accessibilityRole="button"
          accessibilityLabel={t('import.chooseVideo')}
        >
          <MaterialCommunityIcons name="tray-arrow-up" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={s.primaryButtonText}>{t('import.chooseVideo')}</Text>
        </TouchableOpacity>
        <Text style={s.hint}>{t('import.chooseVideoHint')}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.md,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  idleContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  platformLabel: {
    alignSelf: 'stretch',
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMain,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  platformPill: {
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: borderRadius.full,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  platformPillOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  platformPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMain,
  },
  platformPillTextOn: {
    color: '#FFFFFF',
  },
  disclaimerBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.sunsetOrangeLight,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMain,
  },
  handleInput: {
    alignSelf: 'stretch',
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
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.sunsetOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  idleIntro: {
    marginBottom: spacing.xl,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  progressLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textMain,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderColor,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sunsetOrange,
  },
  resultsScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
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
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  candidateRowDisabled: {
    opacity: 0.6,
  },
  checkBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  checkBubbleOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  checkBubbleOff: {
    borderColor: colors.borderColor,
  },
  candidateText: {
    flex: 1,
    gap: 4,
  },
  candidateName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMain,
  },
  candidateNameMuted: {
    color: colors.textSecondary,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrangeLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  confidenceBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
  },
  notOnLocalList: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
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
  dayPill: {
    minWidth: 48,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  dayPillOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  dayPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textMain,
  },
  dayPillTextOn: {
    color: '#FFFFFF',
  },
  dayPillLocked: {
    minWidth: 150,
    backgroundColor: colors.paperWhite,
  },
  dayPillLockedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunsetOrange,
    borderRadius: borderRadius.lg,
    borderCurve: 'continuous',
    paddingVertical: 16,
    paddingHorizontal: spacing.xl,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  errorBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
  retryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.sunsetOrange,
    textDecorationLine: 'underline',
  },
  footerHintText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
