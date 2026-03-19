import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import type { PlanDetailResponse } from '../../lib/types';

const DURATION_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function CustomBuilderScreen() {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [city, setCity] = useState('Miami');
  const [days, setDays] = useState(2);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && city.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate || creating) return;

    setCreating(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const res = await api<PlanDetailResponse>('/plans', {
      method: 'POST',
      body: {
        name: name.trim(),
        city: city.trim(),
        durationDays: days,
      },
    });

    setCreating(false);

    if (res.data) {
      router.replace(`/plan/edit/${res.data.id}`);
    } else {
      setError(res.error ?? 'Failed to create plan');
    }
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
            <Ionicons name="close" size={24} color={colors.textMain} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={s.titleSection}>
          <Text style={s.title}>Build Your Plan</Text>
          <Text style={s.subtitle}>
            Name it, pick a city, and start adding places.
          </Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          {/* Plan name */}
          <View style={s.field}>
            <Text style={s.label}>Plan name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Weekend in Barcelona"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoFocus
            />
          </View>

          {/* City */}
          <View style={s.field}>
            <Text style={s.label}>City</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Miami"
              placeholderTextColor={colors.textSecondary}
              value={city}
              onChangeText={setCity}
              maxLength={50}
            />
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

        {/* Error */}
        {error && (
          <Text style={s.error}>{error}</Text>
        )}

        {/* Create button */}
        <TouchableOpacity
          onPress={handleCreate}
          disabled={!canCreate || creating}
          activeOpacity={0.8}
          style={{ opacity: canCreate && !creating ? 1 : 0.5 }}
        >
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.createBtn}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={s.createBtnText}>Create & Start Editing</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
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
    marginBottom: spacing.xl,
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
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.deepOcean,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  form: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
    borderWidth: 1,
    borderColor: colors.borderColor,
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
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  durationChipActive: {
    backgroundColor: colors.electricBlue,
    borderColor: colors.electricBlue,
  },
  durationText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  durationTextActive: {
    color: '#FFFFFF',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
  },
  createBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
