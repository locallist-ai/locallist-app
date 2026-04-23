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
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PlanMap } from '../../components/map/PlanMap';
import { BottomSheetStop, type Stop } from '../../components/follow/BottomSheetStop';
import { NextStopsCarousel, type PreviewStop } from '../../components/follow/NextStopsCarousel';
import { ProgressDots } from '../../components/ui/design-system';
import { useOfflineTiles } from '../../components/map/useOfflineTiles';
import type { PlanStop, PlanDetailResponse } from '../../lib/types';
import type { MapStop } from '../../components/map/PlanMap';

type FollowSession = { id: string; planId: string; status: string };

const mapToStop = (planStop: PlanStop): Stop => ({
  id: planStop.placeId,
  name: planStop.place?.name ?? 'Unknown place',
  category: planStop.place?.category,
  neighborhood: planStop.place?.neighborhood ?? undefined,
  photos: planStop.place?.photos?.map((url) => ({ url })),
  whyThisPlace: planStop.place?.whyThisPlace,
  duration: planStop.suggestedDurationMin ?? undefined,
  priceRange: planStop.place?.priceRange ?? undefined,
  googleRating: planStop.place?.googleRating ?? null,
  googleReviewCount: planStop.place?.googleReviewCount ?? null,
  timeBlock: planStop.timeBlock ?? undefined,
  suggestedArrival: planStop.suggestedArrival ?? undefined,
  travelFromPrevious: planStop.travelFromPrevious ?? null,
});

const mapToMapStop = (planStop: PlanStop): MapStop | null => {
  const lat = parseFloat(planStop.place?.latitude ?? '');
  const lng = parseFloat(planStop.place?.longitude ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: planStop.placeId,
    name: planStop.place?.name ?? 'Unknown',
    latitude: lat,
    longitude: lng,
    category: planStop.place?.category,
  };
};

const mapToPreviewStop = (planStop: PlanStop): PreviewStop => ({
  id: planStop.placeId,
  name: planStop.place?.name ?? 'Unknown',
  timeBlock: planStop.timeBlock ?? undefined,
  suggestedArrival: planStop.suggestedArrival ?? undefined,
  photoUrl: planStop.place?.photos?.[0] ?? undefined,
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

  const mapStops = useMemo<MapStop[]>(
    () => allStops.map(mapToMapStop).filter((s): s is MapStop => s !== null),
    [allStops],
  );

  const currentStop = useMemo(
    () => (allStops.length > 0 ? mapToStop(allStops[currentIndex]) : null),
    [allStops, currentIndex],
  );

  const previewStops = useMemo<PreviewStop[]>(
    () => allStops.map(mapToPreviewStop),
    [allStops],
  );

  const offlineTileStops = useMemo(
    () => mapStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    [mapStops],
  );
  const { tileUrl, isDownloading, hasCache } = useOfflineTiles(offlineTileStops);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    startSession();
  }, [id, isAuthenticated]);

  const startSession = async () => {
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

    const sessionRes = await api<FollowSession>('/follow/start', {
      method: 'POST',
      body: { planId: id },
    });
    if (sessionRes.data) {
      setSession(sessionRes.data);
    }
    setLoading(false);
  };

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= allStops.length) return;
    setCurrentIndex(nextIndex);
    Haptics.selectionAsync();
  };

  const handleNext = () => {
    if (currentIndex < allStops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleSkip = () => {
    if (currentIndex < allStops.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
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

  const handlePinPress = (mapIndex: number) => {
    const tapped = mapStops[mapIndex];
    if (!tapped) return;
    const targetIndex = allStops.findIndex((st) => st.placeId === tapped.id);
    if (targetIndex >= 0 && targetIndex !== currentIndex) {
      goTo(targetIndex);
    }
  };

  const activeMapPinIndex = Math.max(
    0,
    mapStops.findIndex(
      (st) => allStops[currentIndex] && st.id === allStops[currentIndex].placeId,
    ),
  );

  return (
    <View style={s.root}>
      <PlanMap
        stops={mapStops}
        activePinIndex={activeMapPinIndex}
        onPinPress={handlePinPress}
        style={s.map}
      />

      <BlurView
        intensity={70}
        tint="light"
        style={[s.topBarOverlay, { paddingTop: insets.top + spacing.xs }]}
      >
        <View style={s.topBarRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.closeButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close Follow Mode"
          >
            <Ionicons name="close" size={24} color={colors.deepOcean} />
          </TouchableOpacity>

          <Text style={s.topTitle} numberOfLines={1}>{planName}</Text>

          <Text style={s.stopCounter}>
            {currentIndex + 1}/{allStops.length}
          </Text>
        </View>

        <View style={s.dotsRow}>
          <ProgressDots
            total={allStops.length}
            current={currentIndex}
            size="sm"
            colorPending="rgba(15, 23, 42, 0.18)"
          />
        </View>
      </BlurView>

      <View
        pointerEvents="box-none"
        style={[s.carouselWrap, { top: insets.top + 84 }]}
      >
        <NextStopsCarousel
          stops={previewStops}
          currentIndex={currentIndex}
          onSelect={goTo}
        />
      </View>

      {currentStop && (
        <View style={s.bottomSheetWrap} pointerEvents="box-none">
          <BottomSheetStop
            stop={currentStop}
            onSwipeLeft={handleNext}
            onSwipeRight={handlePrev}
            onPause={handlePause}
            onSkip={handleSkip}
            onNext={handleNext}
          />
        </View>
      )}
    </View>
  );
}

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
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.deepOcean,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  stopCounter: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 48,
    textAlign: 'right',
  },
  dotsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  carouselWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9,
  },
  bottomSheetWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
