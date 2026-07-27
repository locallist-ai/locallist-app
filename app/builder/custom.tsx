import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { StartDateField } from '../../components/ui/StartDateField';
import { EditorialTitle, StepSubtitle, PrimaryButton } from '../../components/ui/design-system';
import { getStartDateSync, setStartDate as persistStartDate } from '../../lib/trip-context-store';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { maxDaysForTier, FREE_MAX_DAYS, PLUS_MAX_DAYS } from '../../components/home/constants';
import type { CityDto } from '../../lib/types';

export default function CustomBuilderScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isPro } = useAuth();
  const { presentGate } = useGateHandler();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Miami');
  const [days, setDays] = useState(2);

  // Duración TIER-AWARE (misma regla que el wizard `DurationStep`): free llega a
  // FREE_MAX_DAYS; Plus desbloquea hasta PLUS_MAX_DAYS. El rango 4..14 se ofrece
  // a los free como una única afford. bloqueada que dispara el upsell (espejo del
  // gate del backend), nunca un no-op silencioso.
  const maxDays = maxDaysForTier(isPro);
  const dayOptions = Array.from({ length: maxDays }, (_, i) => i + 1);

  const handleLockedDuration = () => {
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
  };
  // Fecha de inicio del viaje. Siempre presente (default hoy vía trip-context),
  // editable. Se envía como `yyyy-MM-dd` al crear el plan.
  const [startDate, setStartDate] = useState<string>(() => getStartDateSync());

  const [nameTouched, setNameTouched] = useState(false);
  // "Miami" es ciudad seed válida — empieza confirmada
  const [cityConfirmed, setCityConfirmed] = useState(true);
  const [cityAddError, setCityAddError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<CityDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creatingCity, setCreatingCity] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const nameInputRef = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => nameInputRef.current?.focus(), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const trimmed = city.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = trimmed;
      if (!isMountedRef.current) return;
      setSearching(true);
      const res = await api<{ cities: CityDto[] }>(
        `/cities/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (!isMountedRef.current) return;
      if (lastQueryRef.current !== trimmed) return;
      setSearching(false);
      if (res.data) setSuggestions(res.data.cities ?? []);
      else setSuggestions([]);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [city]);

  const trimmedCity = city.trim();
  const normCity = (s: string) =>
    s.trim().toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const hasExactMatch = suggestions.some(
    (c) => normCity(c.name) === normCity(trimmedCity),
  );
  const showAddOption =
    showSuggestions && trimmedCity.length >= 4 && !hasExactMatch && !searching;

  const handleSelectSuggestion = (c: CityDto) => {
    setCity(c.name);
    setShowSuggestions(false);
    setCityConfirmed(true);
    setCityAddError(null);
    Haptics.selectionAsync();
  };

  const handleAddCustomCity = async () => {
    if (creatingCity) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreatingCity(true);
    const res = await api<CityDto>('/cities', {
      method: 'POST',
      body: { name: trimmedCity },
    });
    if (!isMountedRef.current) return;
    setCreatingCity(false);
    if (res.data) {
      setCity(res.data.name);
      setShowSuggestions(false);
      setCityConfirmed(true);
      setCityAddError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setCityAddError(res.error ?? t('builder.cityAddError'));
    }
  };

  const cityValidation = (() => {
    const trimmed = city.trim();
    if (trimmed.length === 0) return { ok: false, error: null };
    if (trimmed.length < 2) return { ok: false, error: t('builder.cityErrorTooShort') };
    if (trimmed.length > 60) return { ok: false, error: t('builder.cityErrorTooLong') };
    if (!/^[\p{L}][\p{L}\s'\-.]*$/u.test(trimmed)) {
      return { ok: false, error: t('builder.cityErrorInvalidChars') };
    }
    return { ok: true, error: null };
  })();

  const cityError = cityValidation.error;
  const cityUnconfirmedError =
    !cityConfirmed && trimmedCity.length > 0 && cityValidation.ok
      ? t('builder.cityErrorUnconfirmed')
      : null;
  const nameError = nameTouched && name.trim().length === 0 ? t('builder.nameRequired') : null;
  const canCreate = name.trim().length > 0 && cityValidation.ok && cityConfirmed;

  const handleCreate = () => {
    if (!canCreate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/plan/new',
      params: {
        planName: name.trim(),
        planCity: city.trim(),
        planDays: String(days),
        planStartDate: startDate,
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header — gesto de cierre unificado con el resto de flujos modales
          * (import usa `close`): una X, no un chevron-back. custom queda
          * consistente con import-video.tsx. */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {/* Title — voz editorial (sin burbuja de pin: el brief prohíbe el pin
          * como metáfora). Alineado a la izquierda, tono formulario. */}
        <Animated.View entering={FadeInDown.duration(320)} style={s.titleSection}>
          <EditorialTitle text={t('builder.title')} size="sm" align="left" style={s.titleSpacing} />
          <StepSubtitle text={t('builder.subtitle')} align="left" />
        </Animated.View>

        {/* Form card */}
        <Animated.View entering={FadeInDown.duration(500).delay(100).springify().damping(16)}>
          <View style={s.formCard}>
            {/* Plan name */}
            <View style={s.field}>
              <Text style={s.label}>{t('builder.planNameLabel')}</Text>
              <TextInput
                ref={nameInputRef}
                style={[s.input, !!nameError && s.inputError]}
                value={name}
                onChangeText={setName}
                onBlur={() => setNameTouched(true)}
                maxLength={100}
              />
              {!!nameError && <Text style={s.fieldError}>{nameError}</Text>}
            </View>

            {/* City */}
            <View style={s.field}>
              <Text style={s.label}>{t('builder.cityLabel')}</Text>
              <View style={[s.inputWithIcon, !!(cityError || cityUnconfirmedError) && s.inputWithIconError]}>
                <View style={s.inputIconBubble}>
                  {/* Buscador de ciudad: lupa, no pin (el campo BUSCA, y el pin
                    * está vetado por el brief). */}
                  <MaterialCommunityIcons name="magnify" size={18} color={colors.sunsetOrange} />
                </View>
                <TextInput
                  style={s.inputInner}
                  placeholder={t('builder.cityPlaceholder')}
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    setShowSuggestions(true);
                    setCityConfirmed(false);
                    setCityAddError(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  maxLength={60}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {searching && (
                  <ActivityIndicator size="small" color={colors.sunsetOrange} style={{ marginRight: spacing.md }} />
                )}
              </View>

              {/* Autocomplete dropdown */}
              {showSuggestions && (suggestions.length > 0 || showAddOption) && (
                <View style={s.suggestionsList}>
                  {suggestions.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => handleSelectSuggestion(c)}
                      activeOpacity={0.7}
                      style={s.suggestionRow}
                    >
                      <Ionicons name="location-outline" size={16} color={colors.sunsetOrange} />
                      <Text style={s.suggestionText}>{c.name}</Text>
                      {c.country && <Text style={s.suggestionMeta}>· {c.country}</Text>}
                    </TouchableOpacity>
                  ))}
                  {showAddOption && (
                    <TouchableOpacity
                      onPress={handleAddCustomCity}
                      activeOpacity={0.85}
                      style={[s.suggestionRow, s.suggestionRowAdd]}
                      disabled={creatingCity || !!cityError}
                    >
                      {creatingCity ? (
                        <ActivityIndicator size="small" color={colors.sunsetOrange} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={18} color={colors.sunsetOrange} />
                      )}
                      <Text style={s.suggestionAddText} numberOfLines={1}>
                        {t('builder.addCustomCity', { city: trimmedCity })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {cityError ? (
                <Text style={s.fieldError}>{cityError}</Text>
              ) : cityUnconfirmedError ? (
                <Text style={s.fieldError}>{cityUnconfirmedError}</Text>
              ) : cityAddError ? (
                <Text style={s.fieldError}>{cityAddError}</Text>
              ) : (
                <Text style={s.fieldHint}>{t('builder.cityHint')}</Text>
              )}
            </View>

            {/* Duration — pills tier-aware (mismo token de pill que el wizard
              * `DurationStep`, light-surfaced). */}
            <View style={s.field}>
              <Text style={s.label}>{t('builder.durationLabel')}</Text>
              <View style={s.durationRow}>
                {dayOptions.map((d) => {
                  const selected = days === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      testID={`duration-pill-${d}`}
                      style={[s.dayPill, selected && s.dayPillActive]}
                      onPress={() => {
                        setDays(d);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t('common.dayCount', { count: d })}
                    >
                      <Text style={[s.dayPillText, selected && s.dayPillTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Free: afford. bloqueada única para el rango Plus (4..14). */}
                {!isPro && (
                  <TouchableOpacity
                    testID="duration-plus-locked"
                    style={[s.dayPill, s.dayPillLocked]}
                    onPress={handleLockedDuration}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('gate.durationPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
                  >
                    <Ionicons name="lock-closed" size={13} color={colors.sunsetOrange} style={s.lockIcon} />
                    <Text style={s.dayPillLockedText} numberOfLines={1}>
                      {t('gate.durationPlusLocked', { plusMaxDays: PLUS_MAX_DAYS })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Start date */}
            <View style={s.field}>
              <Text style={s.label}>{t('builder.startDateLabel')}</Text>
              <StartDateField
                value={startDate}
                onChange={(iso) => {
                  setStartDate(iso);
                  // Persistimos también en el trip-context para que quede como
                  // preferencia entre flujos (wizard/builder comparten la fecha).
                  void persistStartDate(iso);
                }}
                tone="onLight"
              />
            </View>
          </View>
        </Animated.View>

        {/* Create button — PrimaryButton plano (naranja). Sin gradiente y sin
          * `sparkles`: es un builder MANUAL, no hay IA que insinuar. */}
        <Animated.View entering={FadeInDown.duration(500).delay(200).springify().damping(16)}>
          <PrimaryButton
            label={t('builder.startBuilding')}
            onPress={handleCreate}
            disabled={!canCreate}
            testID="builder-create-button"
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  titleSpacing: {
    marginBottom: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    // Sentence-case Inter semibold — sin uppercase/tracking (estética utility
    // tech, fuera). El copy i18n ya viene en sentence-case.
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMain,
  },
  input: {
    backgroundColor: colors.bgMain,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMain,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWithIconError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '0D',
  },
  inputIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    marginLeft: spacing.sm,
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.error + '0D',
  },
  inputInner: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
  },
  fieldError: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
    paddingHorizontal: spacing.xs,
  },
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    paddingHorizontal: spacing.xs,
    lineHeight: 16,
  },
  suggestionsList: {
    marginTop: 4,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  suggestionRowAdd: {
    backgroundColor: colors.sunsetOrange + '10',
    borderBottomWidth: 0,
  },
  suggestionText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  suggestionMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  suggestionAddText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.sunsetOrange,
    flex: 1,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  // Pill token del wizard (`DurationStep`), light-surfaced para el formulario.
  dayPill: {
    minWidth: 52,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: colors.bgMain,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  dayPillActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  dayPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  dayPillLocked: {
    minWidth: 150,
    backgroundColor: colors.sunsetOrangeLight,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  dayPillLockedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
  lockIcon: {
    marginRight: 6,
  },
});
