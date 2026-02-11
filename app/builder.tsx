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
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, spacing, borderRadius, typography, fonts } from '../lib/theme';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { PaywallModal } from '../components/PaywallModal';

// ─── Constants ────────────────────────────────────────────

type WizardStep = 'group' | 'vibes' | 'duration' | 'details' | 'generating' | 'result';

const GROUP_OPTIONS = [
  { id: 'solo', label: 'Solo' },
  { id: 'couple', label: 'Couple' },
  { id: 'friends', label: 'Friends' },
  { id: 'family-kids', label: 'Family w/ Kids' },
  { id: 'family', label: 'Family' },
  { id: 'group', label: 'Group' },
] as const;

const VIBE_OPTIONS = [
  { id: 'romantic', label: 'Romantic' },
  { id: 'adventurous', label: 'Adventurous' },
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'party', label: 'Party' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'outdoor', label: 'Outdoor' },
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

// ─── Component ────────────────────────────────────────────

export default function BuilderScreen() {
  const router = useRouter();
  const { isAuthenticated, userTier } = useAuth();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('group');
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
    setStep('generating');
    setError(null);

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
      // Rate limited — use upgradeHint from API to pick the right modal
      setStep('details');
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
      setStep('result');
    } else {
      setError(apiError ?? 'Failed to generate plan');
      setStep('details');
    }
  };

  const handleReset = () => {
    setStep('group');
    setGroupType('couple');
    setVibes([]);
    setDays(1);
    setDetails('');
    setResult(null);
    setError(null);
  };

  // ─── Step: Group ──────────────────────────────────────────

  if (step === 'group') {
    return (
      <View style={styles.container}>
        <View style={styles.stepContainer}>
          <Text style={styles.stepIndicator}>Step 1 of 4</Text>
          <Text style={styles.stepTitle}>Who's going?</Text>
          <Text style={styles.stepSubtitle}>Select the group type for your trip</Text>
          <View style={styles.chipGrid}>
            {GROUP_OPTIONS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.chip, groupType === g.id && styles.chipSelected]}
                onPress={() => setGroupType(g.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, groupType === g.id && styles.chipTextSelected]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.navBar}>
          <View />
          <Button title="Next" onPress={() => setStep('vibes')} variant="primary" />
        </View>
      </View>
    );
  }

  // ─── Step: Vibes ──────────────────────────────────────────

  if (step === 'vibes') {
    return (
      <View style={styles.container}>
        <View style={styles.stepContainer}>
          <Text style={styles.stepIndicator}>Step 2 of 4</Text>
          <Text style={styles.stepTitle}>What's the vibe?</Text>
          <Text style={styles.stepSubtitle}>Pick up to 5 vibes for your trip</Text>
          <View style={styles.chipGrid}>
            {VIBE_OPTIONS.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.chip, vibes.includes(v.id) && styles.chipSelected]}
                onPress={() => toggleVibe(v.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, vibes.includes(v.id) && styles.chipTextSelected]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.navBar}>
          <Button title="Back" onPress={() => setStep('group')} variant="ghost" />
          <Button title="Next" onPress={() => setStep('duration')} variant="primary" />
        </View>
      </View>
    );
  }

  // ─── Step: Duration ───────────────────────────────────────

  if (step === 'duration') {
    return (
      <View style={styles.container}>
        <View style={styles.stepContainer}>
          <Text style={styles.stepIndicator}>Step 3 of 4</Text>
          <Text style={styles.stepTitle}>How long?</Text>
          <Text style={styles.stepSubtitle}>Choose the duration of your trip</Text>
          <View style={styles.chipGrid}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, days === d.id && styles.chipSelected]}
                onPress={() => setDays(d.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, days === d.id && styles.chipTextSelected]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.navBar}>
          <Button title="Back" onPress={() => setStep('vibes')} variant="ghost" />
          <Button title="Next" onPress={() => setStep('details')} variant="primary" />
        </View>
      </View>
    );
  }

  // ─── Step: Details + Generate ─────────────────────────────

  if (step === 'details') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.stepContainer}>
          <Text style={styles.stepIndicator}>Step 4 of 4</Text>
          <Text style={styles.stepTitle}>Anything specific?</Text>
          <Text style={styles.stepSubtitle}>
            Optional — add details like "rooftop bars only" or "kid-friendly restaurants"
          </Text>
          <TextInput
            style={styles.detailsInput}
            value={details}
            onChangeText={setDetails}
            placeholder="e.g. rooftop bars, oceanfront dining..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
        <View style={styles.navBar}>
          <Button title="Back" onPress={() => setStep('duration')} variant="ghost" />
          <Button title="Generate Plan" onPress={handleGenerate} variant="primary" />
        </View>

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
            // RevenueCat paywall handled by native IAP
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  // ─── Step: Generating ─────────────────────────────────────

  if (step === 'generating') {
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

  // ─── Step: Result ─────────────────────────────────────────

  if (step === 'result' && result) {
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
        {/* Plan header */}
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

        {/* Day-by-day stops */}
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

        {/* CTAs */}
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

  // Fallback
  return null;
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
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  stepIndicator: {
    ...typography.caption,
    color: colors.electricBlue,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepTitle: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
  },
  chipSelected: {
    backgroundColor: colors.electricBlue,
    borderColor: colors.electricBlue,
  },
  chipText: {
    ...typography.body,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  detailsInput: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textMain,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
  },

  // Generating
  generatingTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  generatingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Result
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
