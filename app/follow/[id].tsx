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
import { FollowDaySheet } from '../../components/follow/FollowDaySheet';
import { ProgressDots } from '../../components/ui/design-system';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PlaceSearchModal } from '../../components/plan-editor/PlaceSearchModal';
import { useOfflineTiles } from '../../components/map/useOfflineTiles';
import type { PlanStop, PlanDetailResponse, Place, UpdateStopsRequest } from '../../lib/types';
import type { MapStop } from '../../components/map/PlanMap';

type FollowSession = { id: string; planId: string; status: string };

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

export default function FollowModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<FollowSession | null>(null);
  const [allStops, setAllStops] = useState<(PlanStop & { id?: string })[]>([]);
  const [planName, setPlanName] = useState('');
  const [planCity, setPlanCity] = useState('');
  const [planCreatedById, setPlanCreatedById] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [stopBeingEdited, setStopBeingEdited] = useState<PlanStop | null>(null);
  const [stopToDelete, setStopToDelete] = useState<PlanStop | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwner = !!(user && planCreatedById && user.id === planCreatedById);

  // Pablo 2026-04-26: Follow Mode debe mostrar UN solo día a la vez en el
  // top bar y mapa — antes los progress dots, el counter, y los pins del
  // mapa sumaban TODOS los stops del plan, lo que confunde en multi-día.
  const currentStopRef = allStops[currentIndex];
  const currentDay = currentStopRef?.dayNumber ?? 1;
  const dayStops = useMemo(
    () => allStops.filter((s) => s.dayNumber === currentDay),
    [allStops, currentDay],
  );
  const dayCurrentIndex = useMemo(() => {
    const idx = dayStops.findIndex(
      (s) => s.placeId === currentStopRef?.placeId && s.orderIndex === currentStopRef?.orderIndex,
    );
    return idx >= 0 ? idx : 0;
  }, [dayStops, currentStopRef]);

  // Pins del mapa: solo del día activo.
  const mapStops = useMemo<MapStop[]>(
    () =>
      allStops
        .filter((s) => s.dayNumber === currentDay)
        .map(mapToMapStop)
        .filter((s): s is MapStop => s !== null),
    [allStops, currentDay],
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
    setPlanCity(planRes.data.city ?? '');
    setPlanCreatedById(planRes.data.createdById ?? null);
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

  // Reload stops desde backend tras editar (mantiene currentIndex en el mismo
  // place si existe, o cae al primer stop disponible).
  const reloadStops = async () => {
    const res = await api<PlanDetailResponse>(`/plans/${id}`);
    if (res.data) {
      const reloaded = res.data.days
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .flatMap((d) => d.stops.sort((a, b) => a.orderIndex - b.orderIndex));
      setAllStops(reloaded);
      // Reajustar currentIndex si el stop activo desapareció.
      const currentPlaceId = allStops[currentIndex]?.placeId;
      const newIdx = reloaded.findIndex((s) => s.placeId === currentPlaceId);
      if (newIdx >= 0) {
        setCurrentIndex(newIdx);
      } else if (reloaded.length > 0) {
        setCurrentIndex(Math.min(currentIndex, reloaded.length - 1));
      } else {
        setCurrentIndex(0);
      }
    }
  };

  // Construye el body para PUT /plans/{id}/stops a partir del state actual,
  // aplicando una transformación opcional sobre el array de stops.
  const persistStops = async (
    transform: (stops: PlanStop[]) => Array<{ placeId: string; dayNumber: number; orderIndex: number; timeBlock: string | null; suggestedDurationMin: number | null }>,
  ): Promise<boolean> => {
    setSavingEdit(true);
    const next = transform(allStops);
    const body: UpdateStopsRequest = { stops: next };
    const res = await api(`/plans/${id}/stops`, { method: 'PUT', body });
    setSavingEdit(false);
    if (res.status >= 200 && res.status < 300) {
      await reloadStops();
      return true;
    }
    Alert.alert('Update failed', res.error ?? 'Could not save the change.');
    return false;
  };

  const handleReplaceStop = (stop: PlanStop) => {
    setStopBeingEdited(stop);
    setSearchVisible(true);
  };

  const handlePlaceSelectedForReplace = async (place: Place) => {
    setSearchVisible(false);
    if (!stopBeingEdited) return;
    const target = stopBeingEdited;
    setStopBeingEdited(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await persistStops((stops) =>
      stops.map((s) => ({
        placeId: s.placeId === target.placeId && s.dayNumber === target.dayNumber && s.orderIndex === target.orderIndex
          ? place.id
          : s.placeId,
        dayNumber: s.dayNumber,
        orderIndex: s.orderIndex,
        timeBlock: s.timeBlock,
        suggestedDurationMin: s.suggestedDurationMin ?? null,
      })),
    );
  };

  const handleDeleteStop = (stop: PlanStop) => {
    setStopToDelete(stop);
  };

  const confirmDeleteStop = async () => {
    if (!stopToDelete) return;
    const target = stopToDelete;
    setStopToDelete(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await persistStops((stops) => {
      // Filtrar el stop target + reindexar orderIndex dentro de su día.
      const filtered = stops.filter(
        (s) => !(s.placeId === target.placeId && s.dayNumber === target.dayNumber && s.orderIndex === target.orderIndex),
      );
      const byDay = new Map<number, PlanStop[]>();
      for (const s of filtered) {
        const arr = byDay.get(s.dayNumber) ?? [];
        arr.push(s);
        byDay.set(s.dayNumber, arr);
      }
      const result: Array<{ placeId: string; dayNumber: number; orderIndex: number; timeBlock: string | null; suggestedDurationMin: number | null }> = [];
      for (const [day, list] of byDay) {
        list
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .forEach((s, i) => {
            result.push({
              placeId: s.placeId,
              dayNumber: day,
              orderIndex: i,
              timeBlock: s.timeBlock,
              suggestedDurationMin: s.suggestedDurationMin ?? null,
            });
          });
      }
      return result;
    });
  };

  const handleChangeDay = (day: number) => {
    const firstOfDay = allStops.findIndex((s) => s.dayNumber === day);
    if (firstOfDay >= 0) setCurrentIndex(firstOfDay);
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
            {dayCurrentIndex + 1}/{dayStops.length}
          </Text>
        </View>

        <View style={s.dotsRow}>
          <ProgressDots
            total={Math.max(dayStops.length, 1)}
            current={dayCurrentIndex}
            size="sm"
            colorPending="rgba(15, 23, 42, 0.18)"
          />
        </View>
      </BlurView>

      <View style={s.dayListWrap} pointerEvents="box-none">
        <FollowDaySheet
          allStops={allStops}
          currentIndex={currentIndex}
          onSelect={goTo}
          onChangeDay={handleChangeDay}
          onReplaceStop={handleReplaceStop}
          onDeleteStop={handleDeleteStop}
          onPause={handlePause}
          onComplete={handleComplete}
          canEdit={isOwner}
        />
      </View>

      <PlaceSearchModal
        visible={searchVisible}
        city={planCity || 'Miami'}
        onSelect={handlePlaceSelectedForReplace}
        onClose={() => {
          setSearchVisible(false);
          setStopBeingEdited(null);
        }}
      />

      <ConfirmModal
        visible={!!stopToDelete}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete this stop?"
        body={`This removes "${stopToDelete?.place?.name ?? 'this stop'}" from your plan permanently.`}
        confirmLabel={savingEdit ? 'Deleting…' : 'Delete'}
        confirmDestructive
        onCancel={() => setStopToDelete(null)}
        onConfirm={confirmDeleteStop}
      />
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
  // Day list sheet — ocupa la mitad inferior de la pantalla (~60% para
  // dejar el mapa visible arriba). El sheet es scrollable internamente.
  dayListWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    zIndex: 10,
  },
});
