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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { StartDateField } from '../../components/ui/StartDateField';
import { getStartDateSync, setStartDate as persistStartDate } from '../../lib/trip-context-store';
import type { CityDto } from '../../lib/types';

const DURATION_OPTIONS = [1, 2, 3] as const;

export default function CustomBuilderScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Miami');
  const [days, setDays] = useState(2);
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
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(320)} style={s.titleSection}>
          <View style={s.titleIcon}>
            <MaterialCommunityIcons name="map-marker-outline" size={28} color={colors.sunsetOrange} />
          </View>
          <Text style={s.title}>{t('builder.title')}</Text>
          <Text style={s.subtitle}>{t('builder.subtitle')}</Text>
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
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.sunsetOrange} />
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

            {/* Duration */}
            <View style={s.field}>
              <Text style={s.label}>{t('builder.durationLabel')}</Text>
              <View style={s.durationRow}>
                {DURATION_OPTIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.durationChip, days === d && s.durationChipActive]}
                    onPress={() => {
                      setDays(d);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.durationText, days === d && s.durationTextActive]}>
                      {t('common.dayCount', { count: d })}
                    </Text>
                  </TouchableOpacity>
                ))}
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

        {/* Create button */}
        <Animated.View entering={FadeInDown.duration(500).delay(200).springify().damping(16)}>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!canCreate}
            activeOpacity={0.8}
            style={{ opacity: canCreate ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={[colors.sunsetOrange, '#ea580c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.createBtn}
            >
              <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              <Text style={s.createBtnText}>{t('builder.startBuilding')}</Text>
            </LinearGradient>
          </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  titleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: colors.deepOcean,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgMain,
  },
  durationChipActive: {
    backgroundColor: colors.sunsetOrange,
  },
  durationText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: borderRadius.lg,
  },
  createBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
