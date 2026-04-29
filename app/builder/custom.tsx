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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import type { CityDto } from '../../lib/types';

const DURATION_OPTIONS = [1, 2, 3] as const;

export default function CustomBuilderScreen() {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Miami');
  const [days, setDays] = useState(2);

  // Autocomplete state — Pablo 2026-04-27. Suggestions vivos al teclear; si
  // no hay match exacto, mostramos opción "Add 'X' as a new city" que dispara
  // POST /cities y queda registrada en la DB.
  const [suggestions, setSuggestions] = useState<CityDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creatingCity, setCreatingCity] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');
  // Audit follow-up D2 (2026-04-27): guard contra setState tras unmount —
  // cold-start search puede tardar ~1s; navegar fuera durante typing causaba
  // updates en componente desmontado.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const nameInputRef = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => nameInputRef.current?.focus(), 650);
    return () => clearTimeout(t);
  }, []);

  // Debounced search en cada cambio de city. 250ms parece un punto dulce
  // entre responsivo y no spamear el backend.
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
      // Si el query cambió mientras llegaba la respuesta, o el componente se
      // desmontó, ignora — no setState fuera de cycle.
      if (!isMountedRef.current) return;
      if (lastQueryRef.current !== trimmed) return;
      setSearching(false);
      if (res.data) setSuggestions(res.data.cities ?? []);
      else setSuggestions([]);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [city]);

  const trimmedCity = city.trim();
  const hasExactMatch = suggestions.some(
    (c) => c.name.toLowerCase() === trimmedCity.toLowerCase(),
  );
  const showAddOption =
    showSuggestions
    && trimmedCity.length >= 2
    && !hasExactMatch
    && !searching;

  const handleSelectSuggestion = (c: CityDto) => {
    setCity(c.name);
    setShowSuggestions(false);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Validación de city name. Pablo 2026-04-27: si la ciudad no está en
  // nuestro catálogo, se crea como nueva location. Reglas:
  //   - 2 a 60 caracteres.
  //   - Letras (incluye acentos), espacios, hyphens, apóstrofes, puntos.
  //   - No solo dígitos ni símbolos.
  // \p{L} = unicode letter (e.g. á, ñ, ü, etc.).
  const cityValidation = (() => {
    const trimmed = city.trim();
    if (trimmed.length === 0) return { ok: false, error: null }; // vacío = no error visible aún
    if (trimmed.length < 2) return { ok: false, error: 'City name must be at least 2 characters' };
    if (trimmed.length > 60) return { ok: false, error: 'City name is too long (max 60)' };
    if (!/^[\p{L}][\p{L}\s'\-.]*$/u.test(trimmed)) {
      return { ok: false, error: 'City name has invalid characters. Use letters, spaces, hyphens or apostrophes.' };
    }
    return { ok: true, error: null };
  })();

  const cityError = cityValidation.error;
  const canCreate = name.trim().length > 0 && cityValidation.ok;

  const handleCreate = () => {
    if (!canCreate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/plan/edit/new',
      params: {
        planName: name.trim(),
        planCity: city.trim(),
        planDays: String(days),
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
            <Ionicons name="map-outline" size={28} color={colors.sunsetOrange} />
          </View>
          <Text style={s.title}>Build Your Plan</Text>
          <Text style={s.subtitle}>
            Name it, pick a city, and start adding your favorite places.
          </Text>
        </Animated.View>

        {/* Form card */}
        <Animated.View entering={FadeInDown.duration(500).delay(100).springify().damping(16)}>
          <View style={s.formCard}>
            {/* Plan name */}
            <View style={s.field}>
              <Text style={s.label}>Plan name</Text>
              <TextInput
                ref={nameInputRef}
                style={s.input}
                value={name}
                onChangeText={setName}
                maxLength={100}
              />
            </View>

            {/* City */}
            <View style={s.field}>
              <Text style={s.label}>City</Text>
              <View style={[s.inputWithIcon, !!cityError && s.inputWithIconError]}>
                <Ionicons name="location-outline" size={18} color={colors.sunsetOrange} style={s.inputIcon} />
                <TextInput
                  style={s.inputInner}
                  placeholder="e.g. Miami"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    setShowSuggestions(true);
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
                        Add "{trimmedCity}" as a new city
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {cityError ? (
                <Text style={s.fieldError}>{cityError}</Text>
              ) : (
                <Text style={s.fieldHint}>
                  If your city isn't in our catalog yet, we'll add it as a new location.
                </Text>
              )}
            </View>

            {/* Duration */}
            <View style={s.field}>
              <Text style={s.label}>Duration</Text>
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
                    <Text
                      style={[
                        s.durationText,
                        days === d && s.durationTextActive,
                      ]}
                    >
                      {d} {d === 1 ? 'day' : 'days'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
              <Text style={s.createBtnText}>Start Building</Text>
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
    backgroundColor: colors.sunsetOrange + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
    backgroundColor: colors.error + '0D', // ~5% alpha
  },
  inputIcon: {
    marginLeft: spacing.md,
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
