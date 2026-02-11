import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, spacing, borderRadius, typography, fonts } from '../lib/theme';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { PaywallModal } from '../components/PaywallModal';

// ─── Constants ────────────────────────────────────────────

const USE_MOCK = __DEV__;

type BuilderPhase = 'form' | 'generating' | 'result';

const GROUP_OPTIONS = [
  { id: 'solo', label: 'Solo', icon: '\u{1F9D1}' },
  { id: 'couple', label: 'Couple', icon: '\u{1F491}' },
  { id: 'friends', label: 'Friends', icon: '\u{1F91D}' },
  { id: 'family-kids', label: 'Family w/ Kids', icon: '\u{1F476}' },
  { id: 'family', label: 'Family', icon: '\u{1F46A}' },
  { id: 'group', label: 'Group', icon: '\u{1F465}' },
] as const;

const VIBE_OPTIONS = [
  { id: 'romantic', label: 'Romantic', icon: '\u{1F339}' },
  { id: 'adventurous', label: 'Adventurous', icon: '\u{1F9D7}' },
  { id: 'relaxed', label: 'Relaxed', icon: '\u{1F334}' },
  { id: 'foodie', label: 'Foodie', icon: '\u{1F37D}' },
  { id: 'cultural', label: 'Cultural', icon: '\u{1F3A8}' },
  { id: 'party', label: 'Party', icon: '\u{1F389}' },
  { id: 'wellness', label: 'Wellness', icon: '\u{1F9D8}' },
  { id: 'outdoor', label: 'Outdoor', icon: '\u{1F3D5}' },
] as const;

const DURATION_OPTIONS = [
  { id: 1, label: '1 Day' },
  { id: 2, label: 'Weekend' },
  { id: 3, label: '3 Days' },
  { id: 5, label: '5 Days' },
  { id: 7, label: 'Full Week' },
] as const;

interface PlanStop {
  dayNumber: number;
  orderIndex: number;
  timeBlock: string;
  suggestedArrival: string | null;
  suggestedDurationMin: number;
  travelFromPrevious: { distance_km: number; duration_min: number; mode: string } | null;
  place: {
    id: string;
    name: string;
    category: string;
    neighborhood: string | null;
    whyThisPlace: string;
    priceRange: string | null;
    photos: string[] | null;
  } | null;
}

interface PlanResult {
  plan: {
    id: string;
    name: string;
    city: string;
    description: string | null;
    durationDays: number;
    isEphemeral?: boolean;
  };
  stops: PlanStop[];
  message: string;
  usage: { tier: string; remaining: number | null; limit: number | null };
}

const MOCK_RESULT: PlanResult = {
  plan: {
    id: 'mock-plan-001',
    name: 'Miami Highlights',
    city: 'Miami',
    description: 'A curated day hitting the best spots in Miami — from coffee to cocktails.',
    durationDays: 1,
    isEphemeral: true,
  },
  stops: [
    {
      dayNumber: 1,
      orderIndex: 0,
      timeBlock: 'morning',
      suggestedArrival: '9:00 AM',
      suggestedDurationMin: 45,
      travelFromPrevious: null,
      place: {
        id: 'mock-1',
        name: 'Café La Trova',
        category: 'coffee',
        neighborhood: 'Little Havana',
        whyThisPlace: 'Old-school Cuban coffee with live bolero music — the real Little Havana experience.',
        priceRange: '$$',
        photos: null,
      },
    },
    {
      dayNumber: 1,
      orderIndex: 1,
      timeBlock: 'morning',
      suggestedArrival: '10:30 AM',
      suggestedDurationMin: 90,
      travelFromPrevious: { distance_km: 3.2, duration_min: 8, mode: 'drive' },
      place: {
        id: 'mock-2',
        name: 'Pérez Art Museum Miami',
        category: 'culture',
        neighborhood: 'Downtown',
        whyThisPlace: 'World-class contemporary art with stunning Biscayne Bay views from the terrace.',
        priceRange: '$$',
        photos: null,
      },
    },
    {
      dayNumber: 1,
      orderIndex: 2,
      timeBlock: 'afternoon',
      suggestedArrival: '1:00 PM',
      suggestedDurationMin: 60,
      travelFromPrevious: { distance_km: 5.1, duration_min: 12, mode: 'drive' },
      place: {
        id: 'mock-3',
        name: 'Mandolin Aegean Bistro',
        category: 'food',
        neighborhood: 'Design District',
        whyThisPlace: 'Mediterranean lunch in a gorgeous courtyard garden — a local favorite that never disappoints.',
        priceRange: '$$$',
        photos: null,
      },
    },
    {
      dayNumber: 1,
      orderIndex: 3,
      timeBlock: 'afternoon',
      suggestedArrival: '3:00 PM',
      suggestedDurationMin: 120,
      travelFromPrevious: { distance_km: 1.8, duration_min: 5, mode: 'walk' },
      place: {
        id: 'mock-4',
        name: 'Design District',
        category: 'culture',
        neighborhood: 'Design District',
        whyThisPlace: 'Open-air luxury shopping and street art — the best people-watching in Miami.',
        priceRange: 'Free',
        photos: null,
      },
    },
    {
      dayNumber: 1,
      orderIndex: 4,
      timeBlock: 'evening',
      suggestedArrival: '7:00 PM',
      suggestedDurationMin: 90,
      travelFromPrevious: { distance_km: 8.5, duration_min: 18, mode: 'drive' },
      place: {
        id: 'mock-5',
        name: 'Juvia',
        category: 'food',
        neighborhood: 'South Beach',
        whyThisPlace: 'Rooftop dining with panoramic views — French-Japanese-Peruvian fusion that actually works.',
        priceRange: '$$$$',
        photos: null,
      },
    },
  ],
  message: 'Here\'s your curated Miami plan!',
  usage: { tier: 'anonymous', remaining: 2, limit: 3 },
};

// ─── Component ────────────────────────────────────────────

export default function BuilderScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Form state
  const [phase, setPhase] = useState<BuilderPhase>('form');
  const [groupType, setGroupType] = useState<string>('couple');
  const [vibes, setVibes] = useState<string[]>([]);
  const [days, setDays] = useState<number>(1);
  const [details, setDetails] = useState('');

  // Result state
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const toggleVibe = (id: string) => {
    setVibes((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const buildMessage = (): string => {
    const parts: string[] = [];
    const groupLabel = GROUP_OPTIONS.find((g) => g.id === groupType)?.label ?? groupType;
    parts.push(`${groupLabel} trip`);
    if (vibes.length > 0) parts.push(`vibes: ${vibes.join(', ')}`);
    const durLabel = DURATION_OPTIONS.find((d) => d.id === days)?.label ?? `${days} days`;
    parts.push(durLabel);
    if (details.trim()) parts.push(details.trim());
    return parts.join('. ');
  };

  const handleGenerate = async () => {
    setPhase('generating');
    setError(null);

    // Mock mode — simulate API delay and return fake data
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 1500));
      setResult({
        ...MOCK_RESULT,
        plan: {
          ...MOCK_RESULT.plan,
          durationDays: days,
          name: `Miami ${days === 1 ? 'Day Trip' : `${days}-Day`} ${vibes[0] ? vibes[0].charAt(0).toUpperCase() + vibes[0].slice(1) + ' ' : ''}Plan`,
        },
      });
      setPhase('result');
      return;
    }

    const message = buildMessage();

    const { data, error: apiError, errorBody, status } = await api<PlanResult>('/builder/chat', {
      method: 'POST',
      body: {
        message,
        tripContext: {
          groupType,
          vibes,
          days,
          city: 'Miami',
        },
      },
    });

    if (status === 429) {
      setPhase('form');
      const hint = errorBody?.upgradeHint;
      if (hint === 'signup') {
        setShowSignupModal(true);
      } else if (hint === 'upgrade') {
        setShowPaywallModal(true);
      } else if (!isAuthenticated) {
        setShowSignupModal(true);
      } else {
        setShowPaywallModal(true);
      }
      return;
    }

    if (data) {
      setResult(data);
      setPhase('result');
    } else {
      setError(apiError ?? 'Failed to generate plan');
      setPhase('form');
    }
  };

  const handleReset = () => {
    setPhase('form');
    setGroupType('couple');
    setVibes([]);
    setDays(1);
    setDetails('');
    setResult(null);
    setError(null);
  };

  // ─── Phase: Generating ──────────────────────────────────────

  if (phase === 'generating') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={styles.generatingTitle}>Building your plan...</Text>
        <Text style={styles.generatingSubtitle}>
          Matching you with the best spots in Miami
        </Text>
      </View>
    );
  }

  // ─── Phase: Result ──────────────────────────────────────────

  if (phase === 'result' && result) {
    const { plan, stops, usage } = result;
    const isEphemeral = (plan as any).isEphemeral === true;
    const groupedByDay: Record<number, PlanStop[]> = {};
    for (const stop of stops) {
      if (!groupedByDay[stop.dayNumber]) groupedByDay[stop.dayNumber] = [];
      groupedByDay[stop.dayNumber].push(stop);
    }
    const dayNumbers = Object.keys(groupedByDay)
      .map(Number)
      .sort((a, b) => a - b);

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>{plan.name}</Text>
          <Text style={styles.resultMeta}>
            {plan.city} &middot; {plan.durationDays} {plan.durationDays === 1 ? 'day' : 'days'} &middot; {stops.length} stops
          </Text>
          {usage.remaining !== null && usage.limit !== null && (
            <Text style={styles.usageText}>
              {usage.remaining} of {usage.limit} plans remaining today
            </Text>
          )}
        </View>

        {dayNumbers.map((dayNum) => (
          <View key={dayNum} style={styles.daySection}>
            <Text style={styles.dayTitle}>Day {dayNum}</Text>
            {groupedByDay[dayNum].map((stop, i) => (
              <View key={i} style={styles.stopCard}>
                {stop.place ? (
                  <>
                    <View style={styles.stopHeader}>
                      <Text style={styles.stopTime}>
                        {stop.suggestedArrival ?? stop.timeBlock}
                      </Text>
                      <View style={styles.stopCategoryBadge}>
                        <Text style={styles.stopCategoryText}>{stop.place.category}</Text>
                      </View>
                    </View>
                    <Text style={styles.stopName}>{stop.place.name}</Text>
                    {stop.place.neighborhood && (
                      <Text style={styles.stopNeighborhood}>{stop.place.neighborhood}</Text>
                    )}
                    <Text style={styles.stopWhy}>{stop.place.whyThisPlace}</Text>
                    {stop.travelFromPrevious && (
                      <Text style={styles.travelInfo}>
                        {stop.travelFromPrevious.duration_min} min {stop.travelFromPrevious.mode} ({stop.travelFromPrevious.distance_km} km)
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.stopName}>Place details unavailable</Text>
                )}
              </View>
            ))}
          </View>
        ))}

        <View style={styles.resultActions}>
          {isEphemeral && !isAuthenticated && (
            <Button
              title="Sign Up to Save This Plan"
              onPress={() => router.push('/(auth)/login')}
              variant="primary"
              size="lg"
              style={styles.resultAction}
            />
          )}
          {!isEphemeral && (
            <Button
              title="View Full Plan"
              onPress={() => router.push(`/plan/${plan.id}`)}
              variant="primary"
              size="lg"
              style={styles.resultAction}
            />
          )}
          <Button
            title="Build Another Plan"
            onPress={handleReset}
            variant="outline"
            size="lg"
            style={styles.resultAction}
          />
        </View>
      </ScrollView>
    );
  }

  // ─── Phase: Form (single page) ─────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.formScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Plan Your Trip</Text>
          <Text style={styles.formSubtitle}>
            Pick your preferences and we'll craft the perfect itinerary.
          </Text>
        </View>

        {/* ── Group Type ──────────────────────── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>WHO'S GOING?</Text>
          <View style={styles.chipGrid}>
            {GROUP_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.chip, groupType === g.id && styles.chipSelected]}
                onPress={() => setGroupType(g.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{g.icon}</Text>
                <Text style={[styles.chipText, groupType === g.id && styles.chipTextSelected]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Vibes ───────────────────────────── */}
        <View style={styles.fieldSection}>
          <View style={styles.fieldLabelRow}>
            <Text style={styles.fieldLabel}>WHAT'S THE VIBE?</Text>
            <Text style={styles.fieldHint}>{vibes.length}/5</Text>
          </View>
          <View style={styles.chipGrid}>
            {VIBE_OPTIONS.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, vibes.includes(v.id) && styles.chipSelected]}
                onPress={() => toggleVibe(v.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{v.icon}</Text>
                <Text style={[styles.chipText, vibes.includes(v.id) && styles.chipTextSelected]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Duration ────────────────────────── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>HOW LONG?</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.durationChip, days === d.id && styles.durationChipSelected]}
                onPress={() => setDays(d.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.durationText, days === d.id && styles.durationTextSelected]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Details (optional) ──────────────── */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>ANYTHING SPECIFIC?</Text>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="Optional — rooftop bars, oceanfront dining, kid-friendly..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* ── Generate Button ─────────────────── */}
        <TouchableOpacity activeOpacity={0.9} onPress={handleGenerate}>
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.generateBtn}
          >
            <Text style={styles.generateBtnText}>Generate My Plan</Text>
            <Text style={styles.generateBtnIcon}>{'\u2192'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.generateDisclaimer}>
          Powered by AI. One call, zero fluff.
        </Text>
      </ScrollView>

      <SignupPromptModal
        visible={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSignUp={() => {
          setShowSignupModal(false);
          router.push('/(auth)/login');
        }}
      />
      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onUpgrade={() => {
          setShowPaywallModal(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },

  // ── Form ─────────────────────────────────
  formScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: 64,
    paddingBottom: 40,
  },
  formHeader: {
    marginBottom: 28,
  },
  formTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.deepOcean,
    lineHeight: 38,
    marginBottom: 8,
  },
  formSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // ── Field Sections ───────────────────────
  fieldSection: {
    marginBottom: 28,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    letterSpacing: 2,
    marginBottom: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fieldHint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },

  // ── Chips (group + vibes) ────────────────
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.deepOcean,
    borderColor: colors.deepOcean,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textMain,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },

  // ── Duration ─────────────────────────────
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
  },
  durationChipSelected: {
    backgroundColor: colors.deepOcean,
    borderColor: colors.deepOcean,
  },
  durationText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textMain,
  },
  durationTextSelected: {
    color: '#FFFFFF',
  },

  // ── Details Input ────────────────────────
  detailsInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.md,
  },

  // ── Generate Button ──────────────────────
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  generateBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  generateBtnIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  generateDisclaimer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },

  // ── Generating ───────────────────────────
  generatingTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  generatingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── Result ───────────────────────────────
  resultContent: {
    paddingBottom: spacing.xxl,
  },
  resultHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  resultTitle: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  resultMeta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  usageText: {
    ...typography.caption,
    color: colors.electricBlue,
    marginTop: spacing.xs,
  },
  daySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  dayTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  stopCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stopTime: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.electricBlue,
  },
  stopCategoryBadge: {
    backgroundColor: colors.electricBlueLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  stopCategoryText: {
    ...typography.caption,
    color: colors.electricBlue,
    textTransform: 'capitalize',
  },
  stopName: {
    ...typography.h3,
    marginBottom: 2,
  },
  stopNeighborhood: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  stopWhy: {
    ...typography.bodySmall,
    color: colors.textMain,
    fontStyle: 'italic',
  },
  travelInfo: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  resultActions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  resultAction: {
    width: '100%',
  },
});
