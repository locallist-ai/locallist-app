import React, { useEffect, useMemo, useState } from 'react';
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PlanMap } from '../../components/map/PlanMap';
import { BottomSheetStop } from '../../components/follow/BottomSheetStop';
import { useOfflineTiles } from '../../components/map/useOfflineTiles';
import type { PlanStop, PlanDetailResponse } from '../../lib/types';
import type { MapStop } from '../../components/map/PlanMap';

type FollowSession = { id: string; planId: string; status: string };

/** Map PlanStop to the Stop shape expected by BottomSheetStop */
const mapToStop = (planStop: PlanStop) => ({
  id: planStop.placeId,
  name: planStop.place?.name ?? 'Unknown place',
  category: planStop.place?.category,
  neighborhood: planStop.place?.neighborhood ?? undefined,
  photos: planStop.place?.photos?.map((url) => ({ url })),
  whyThisPlace: planStop.place?.whyThisPlace,
  duration: planStop.suggestedDurationMin ?? undefined,
  priceRange: planStop.place?.priceRange ?? undefined,
});

/** Map PlanStop to the MapStop shape expected by PlanMap */
const mapToMapStop = (planStop: PlanStop): MapStop => ({
  id: planStop.placeId,
  name: planStop.place?.name ?? 'Unknown',
  latitude: parseFloat(planStop.place?.latitude ?? '0'),
  longitude: parseFloat(planStop.place?.longitude ?? '0'),
  category: planStop.place?.category,
});

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

  // Animated progress bar width (0..1)
  const progressAnim = useSharedValue(0);

  // Convert PlanStops to MapStop[] for PlanMap (memoised)
  const mapStops = useMemo<MapStop[]>(
    () => allStops.map(mapToMapStop),
    [allStops],
  );

  // Current stop mapped for BottomSheetStop (memoised)
  const currentStop = useMemo(
    () => (allStops.length > 0 ? mapToStop(allStops[currentIndex]) : null),
    [allStops, currentIndex],
  );

  // Offline tiles
  const offlineTileStops = useMemo(
    () =>
      mapStops.map((s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
      })),
    [mapStops],
  );
  const { tileUrl, isDownloading, hasCache } = useOfflineTiles(offlineTileStops);

  // ─── Animate progress bar when currentIndex or total changes ───
  useEffect(() => {
    if (allStops.length === 0) return;
    const target = (currentIndex + 1) / allStops.length;
    progressAnim.value = withTiming(target, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentIndex, allStops.length, progressAnim]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  // ─── Auth guard + load plan ───
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

  // ─── Navigation handlers ───
  const handleNext = () => {
    if (currentIndex < allStops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
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
    // Haptic feedback for completion
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

  // ─── Loading state ───
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={s.loadingText}>Starting Follow Mode...</Text>
      </View>
    );
  }

  // ─── Error state ───
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

  // ─── Main layout: full-screen map + overlays ───
  return (
    <View style={s.root}>
      {/* Full-screen map background */}
      <PlanMap
        stops={mapStops}
        activePinIndex={currentIndex}
        style={s.map}
      />

      {/* Transparent top bar overlay */}
      <View style={[s.topBarOverlay, { paddingTop: insets.top + spacing.xs }]}>
        <View style={s.topBarRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.closeButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color={colors.deepOcean} />
          </TouchableOpacity>

          <Text style={s.topTitle} numberOfLines={1}>
            {planName}
          </Text>

          <Text style={s.stopCounter}>
            Stop {currentIndex + 1}/{allStops.length}
          </Text>
        </View>

        {/* Animated progress bar */}
        <View style={s.progressBg}>
          <Animated.View style={[s.progressFill, progressBarStyle]} />
        </View>
      </View>

      {/* Bottom sheet stop overlay */}
      <View style={[s.bottomSheetWrap, { paddingBottom: insets.bottom }]}>
        {currentStop && (
          <BottomSheetStop
            stop={currentStop}
            index={currentIndex}
            totalStops={allStops.length}
            onSwipeLeft={handleNext}
            onSwipeRight={handlePrev}
            onPause={handlePause}
            onSkip={handleSkip}
            onNext={handleNext}
            style={s.bottomSheet}
          />
        )}
      </View>
    </View>
  );
}

const BOTTOM_SHEET_HEIGHT = 350;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
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
  backBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Full-screen map
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top bar overlay (positioned absolutely over the map)
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(242, 239, 233, 0.92)',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  stopCounter: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },

  // Animated progress bar
  progressBg: {
    height: 4,
    backgroundColor: colors.borderColor,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.electricBlue,
    borderRadius: 2,
  },

  // Bottom sheet wrapper
  bottomSheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    zIndex: 10,
  },
  bottomSheet: {
    flex: 1,
  },
});
