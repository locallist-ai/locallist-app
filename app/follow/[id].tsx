import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { PlanStop, PlanDetailResponse } from '../../lib/types';

type FollowSession = { id: string; planId: string; status: string };

const TIME_BLOCK_ICONS: Record<string, string> = {
  morning: 'sunny-outline',
  lunch: 'restaurant-outline',
  afternoon: 'cafe-outline',
  dinner: 'moon-outline',
  evening: 'musical-notes-outline',
};

export default function FollowModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<FollowSession | null>(null);
  const [allStops, setAllStops] = useState<(PlanStop & { id?: string })[]>([]);
  const [planName, setPlanName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    startSession();
  }, [id, isAuthenticated]);

  const startSession = async () => {
    // Fetch plan details
    const planRes = await api<PlanDetailResponse>(`/plans/${id}`);
    if (!planRes.data) {
      setError(planRes.error ?? 'Failed to load plan');
      setLoading(false);
      return;
    }

    setPlanName(planRes.data.name);
    const stops = planRes.data.days
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .flatMap((d) => d.stops.sort((a, b) => a.orderIndex - b.orderIndex));
    setAllStops(stops);

    // Start follow session
    const sessionRes = await api<FollowSession>('/follow/start', {
      method: 'POST',
      body: { planId: id },
    });
    if (sessionRes.data) {
      setSession(sessionRes.data);
    }
    // Non-blocking: session creation failing shouldn't block the UI
    setLoading(false);
  };

  const handleNext = () => {
    if (currentIndex < allStops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (currentIndex < allStops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (session) {
      await api(`/follow/${session.id}/complete`, { method: 'PATCH' });
    }
    Alert.alert('Trip Complete!', 'You finished the plan. Enjoy your trip!', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const handlePause = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={s.loadingText}>Starting Follow Mode...</Text>
      </View>
    );
  }

  if (error || allStops.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error ?? 'No stops in this plan'}</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const current = allStops[currentIndex];
  const next = currentIndex < allStops.length - 1 ? allStops[currentIndex + 1] : null;
  const isLastStop = currentIndex === allStops.length - 1;
  const tb = current.timeBlock ? TIME_BLOCK_ICONS[current.timeBlock] : null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.deepOcean} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{planName}</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Progress */}
      <View style={s.progressWrap}>
        <View style={s.progressBg}>
          <View
            style={[
              s.progressFill,
              { width: `${((currentIndex + 1) / allStops.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={s.progressText}>
          Stop {currentIndex + 1} of {allStops.length}
        </Text>
      </View>

      {/* Current stop card */}
      <View style={s.mainCard}>
        <View style={s.stopTimeRow}>
          {tb && (
            <Ionicons name={tb as any} size={20} color={colors.sunsetOrange} />
          )}
          {current.suggestedArrival && (
            <Text style={s.arrivalTime}>{current.suggestedArrival}</Text>
          )}
          {current.timeBlock && (
            <View style={s.timeBlockBadge}>
              <Text style={s.timeBlockText}>{current.timeBlock}</Text>
            </View>
          )}
        </View>

        <Text style={s.currentPlaceName}>{current.place?.name ?? 'Unknown place'}</Text>

        {current.place?.category && (
          <View style={s.categoryChip}>
            <Text style={s.categoryText}>{current.place.category}</Text>
          </View>
        )}

        {current.place?.neighborhood && (
          <Text style={s.neighborhood}>{current.place.neighborhood}</Text>
        )}

        {current.place?.whyThisPlace && (
          <Text style={s.whyText}>{current.place.whyThisPlace}</Text>
        )}

        {current.suggestedDurationMin != null && (
          <View style={s.durationRow}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={s.durationText}>~{current.suggestedDurationMin} min</Text>
          </View>
        )}
      </View>

      {/* Next stop preview */}
      {next && (
        <View style={s.nextPreview}>
          {next.travelFromPrevious && (
            <View style={s.travelInfo}>
              <Ionicons
                name={next.travelFromPrevious.mode === 'walk' ? 'walk-outline' : 'car-outline'}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={s.travelText}>
                {Math.round(next.travelFromPrevious.duration_min)} min {next.travelFromPrevious.mode} to next stop
              </Text>
            </View>
          )}
          <View style={s.nextCard}>
            <Text style={s.nextLabel}>Up next</Text>
            <Text style={s.nextName} numberOfLines={1}>{next.place?.name ?? 'Unknown place'}</Text>
          </View>
        </View>
      )}

      {/* Bottom actions */}
      <View style={[s.bottomActions, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={s.pauseBtn} activeOpacity={0.7} onPress={handlePause}>
          <Ionicons name="pause-outline" size={20} color={colors.textMain} />
          <Text style={s.pauseBtnText}>Pause</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} activeOpacity={0.7} onPress={handleSkip}>
          <Text style={s.skipBtnText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.nextBtn} activeOpacity={0.8} onPress={handleNext}>
          <Text style={s.nextBtnText}>{isLastStop ? 'Finish' : 'Next Stop'}</Text>
          <Ionicons
            name={isLastStop ? 'checkmark' : 'arrow-forward'}
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.electricBlue,
  },
  backBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#FFFFFF' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  topTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // Progress
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  progressBg: {
    height: 4,
    backgroundColor: colors.borderColor,
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.electricBlue,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Main card
  mainCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    flex: 1,
    minHeight: 200,
  },
  stopTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  arrivalTime: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.sunsetOrange },
  timeBlockBadge: {
    backgroundColor: colors.sunsetOrange + '12',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  timeBlockText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.sunsetOrange, textTransform: 'capitalize' },
  currentPlaceName: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.electricBlue + '12',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  categoryText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.electricBlue },
  neighborhood: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  whyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMain,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durationText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },

  // Next preview
  nextPreview: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  travelText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  nextCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  nextLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  nextName: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.deepOcean },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  pauseBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMain },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  skipBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textSecondary },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.electricBlue,
  },
  nextBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
