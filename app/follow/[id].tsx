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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import { logger } from '../../lib/logger';
import { useAuth } from '../../lib/auth';
import { useGateHandler } from '../../lib/useGateHandler';
import { PlanMap } from '../../components/map/PlanMap';
import { FollowDaySheet } from '../../components/follow/FollowDaySheet';
import { OfflineBanner } from '../../components/follow/OfflineBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { ProgressDots } from '../../components/ui/design-system';
import { clearResume, getResume, setResume } from '../../lib/follow/resume-store';
import { savePlan, loadPlan, removePlan } from '../../lib/follow/plan-store';
import {
  enqueueComplete,
  flushQueue,
  type QueuedMutation,
} from '../../lib/follow/mutation-queue';
import { prefetchDayPhotos } from '../../lib/follow/photo-prefetch';
import { useConnectivity } from '../../lib/connectivity/use-connectivity';
import type { PlanStop, PlanDetailResponse, RouteSegment } from '../../lib/types';
import type { MapStop } from '../../components/map/PlanMap';

type FollowSession = { id: string; planId: string; status: string };

// Sender de la cola de mutaciones: reusa el cliente `api` (auto-refresh de JWT).
// Vive a nivel de módulo porque no depende del render y lo comparten el flush de
// arranque y el de `executeComplete`.
const sendCompleteMutation = async (mutation: QueuedMutation): Promise<number> => {
  const res = await api(`/follow/${mutation.sessionId}/complete`, { method: 'PATCH' });
  return res.status;
};

const mapToMapStop = (planStop: PlanStop): MapStop | null => {
  const lat = planStop.place?.latitude;
  const lng = planStop.place?.longitude;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: planStop.placeId,
    name: planStop.place?.name ?? 'Unknown',
    latitude: lat,
    longitude: lng,
    category: planStop.place?.category,
    orderIndex: planStop.orderIndex,
  };
};

export default function FollowModeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const { presentGate } = useGateHandler();
  const insets = useSafeAreaInsets();

  // Conectividad en tiempo real. Al RECONECTAR (offline -> online) drena la cola
  // de mutaciones durable de #108 (mejor UX que esperar al próximo montaje): un
  // `/complete` encolado sin red sale en cuanto vuelve la conexión. `flushQueue`
  // es idempotente y reentrante-seguro, así que si ya está vacía es no-op.
  const { isOffline } = useConnectivity({
    onReconnect: () => {
      void flushQueue(sendCompleteMutation);
    },
  });

  const [session, setSession] = useState<FollowSession | null>(null);
  const [allStops, setAllStops] = useState<(PlanStop & { id?: string })[]>([]);
  const [planName, setPlanName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [completeConfirmVisible, setCompleteConfirmVisible] = useState(false);

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

  const mapStops = useMemo<MapStop[]>(
    () =>
      allStops
        .filter((s) => s.dayNumber === currentDay)
        .map(mapToMapStop)
        .filter((s): s is MapStop => s !== null),
    [allStops, currentDay],
  );

  // TODOS los stops del plan (todos los días) para el bbox del pack offline: el
  // pack debe cubrir el plan entero, no el día visible (si no, días 2..N sin
  // tiles). Solo alimenta el cálculo de bounds del pack, no el render.
  const packMapStops = useMemo<MapStop[]>(
    () => allStops.map(mapToMapStop).filter((s): s is MapStop => s !== null),
    [allStops],
  );

  // Persiste el stop actual en SecureStore para reanudar tras cerrar la app.
  useEffect(() => {
    if (!id || allStops.length === 0) return;
    const stop = allStops[currentIndex];
    if (!stop) return;
    void setResume(id, stop.dayNumber, stop.orderIndex);
  }, [id, currentIndex, allStops]);

  // Prefetch de las fotos del día activo a la caché de disco de expo-image, para
  // que se vean offline. Solo el día actual; silencioso y tolerante a fallos.
  useEffect(() => {
    if (dayStops.length === 0) return;
    prefetchDayPhotos(dayStops);
  }, [dayStops]);

  useEffect(() => {
    if (!isAuthenticated) {
      // A guest can deep-link straight into Follow Mode. Self-guard before any
      // network (no raw 401) and show the deferred-signup gate, mirroring the
      // plan screen's handleFollow, instead of the legacy hard /login wall.
      // Send them into the guest app so they aren't stranded on the spinner.
      presentGate({ type: 'signup_required' });
      router.replace('/(tabs)/home');
      return;
    }
    let cancelled = false;
    const abortController = new AbortController();

    // Vuelca cualquier `/complete` que quedara pendiente (p. ej. se completó un
    // viaje sin red y la app se cerró) de forma oportunista al reabrir Follow
    // Mode. No depende de netinfo: si sigue sin red, el flush conserva la cola.
    void flushQueue(sendCompleteMutation);

    // Pinta el plan en el estado y aplica la posición de reanudación. Devuelve
    // los stops ordenados para poder resolver el resume-index.
    const applyPlan = async (data: PlanDetailResponse, cached: boolean) => {
      setFromCache(cached);
      setPlanName(data.name);
      setRouteSegments(data.routeSegments ?? []);
      const stops = [...data.days]
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .flatMap((d) => [...d.stops].sort((a, b) => a.orderIndex - b.orderIndex));
      setAllStops(stops);

      const resume = await getResume(id);
      if (cancelled) return;
      if (resume) {
        const resumeIdx = stops.findIndex(
          (s) => s.dayNumber === resume.dayNumber && s.orderIndex === resume.orderIndex,
        );
        if (resumeIdx >= 0) setCurrentIndex(resumeIdx);
      }
    };

    void (async () => {
      try {
        const planRes = await api<PlanDetailResponse>(`/plans/${id}`, {
          signal: abortController.signal,
        });
        if (cancelled) return;

        if (planRes.data) {
          // Red OK: pinta y persiste a disco para futuros arranques offline.
          await applyPlan(planRes.data, false);
          if (cancelled) return;
          void savePlan(id, planRes.data);
        } else {
          // Sin datos (offline/timeout/404): intenta el plan persistido a disco.
          const cached = await loadPlan(id);
          if (cancelled) return;
          if (cached) {
            await applyPlan(cached, true);
            if (cancelled) return;
          } else {
            setError(planRes.error ?? t('follow.loadError'));
            setLoading(false);
            return;
          }
        }

        // `/follow/start` es best-effort: sin sesión (offline) el usuario sigue
        // avanzando en local y `executeComplete` encola el complete igualmente.
        const sessionRes = await api<FollowSession>('/follow/start', {
          method: 'POST',
          body: { planId: id },
          signal: abortController.signal,
        });
        if (cancelled) return;
        if (sessionRes.data) {
          setSession(sessionRes.data);
          track({ event: 'follow_started', planId: id });
        }
        setLoading(false);
      } catch (err) {
        logger.error('Follow Mode init failed', err);
        if (cancelled) return;
        // Último recurso: si algo lanzó, intenta el plan cacheado antes de rendirse.
        const cached = await loadPlan(id).catch(() => null);
        if (cancelled) return;
        if (cached) {
          await applyPlan(cached, true);
          if (cancelled) return;
          setLoading(false);
        } else {
          setError(t('follow.loadError'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t es estable; re-ejecutar al cambiar idioma crearía otra FollowSession
  }, [id, isAuthenticated]);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= allStops.length) return;
    setCurrentIndex(nextIndex);
    Haptics.selectionAsync();
  };

  const handleComplete = () => {
    setCompleteConfirmVisible(true);
  };

  const executeComplete = async () => {
    setCompleteConfirmVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (session) {
      // Encola durablemente el `/complete` ANTES de limpiar nada: si no hay red,
      // la mutación sobrevive al cierre de la app y se reintenta al reabrir.
      await enqueueComplete(session.id, id);
      // Flush oportunista: con red, esto dispara el PATCH ahora mismo (mismo
      // comportamiento observable en el servidor que la llamada directa previa).
      void flushQueue(sendCompleteMutation);
    }
    // Seguro ahora: la mutación está durablemente encolada (o no había sesión).
    void clearResume(id);
    void removePlan(id);
    track({ event: 'follow_completed', planId: id, stopsCompleted: allStops.length });
    Alert.alert(t('follow.tripCompleteTitle'), t('follow.tripCompleteBody'), [
      { text: t('follow.done'), onPress: () => router.back() },
    ]);
  };

  const handleChangeDay = (day: number) => {
    const firstOfDay = allStops.findIndex((s) => s.dayNumber === day);
    if (firstOfDay >= 0) setCurrentIndex(firstOfDay);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={s.loadingText}>{t('follow.loading')}</Text>
      </View>
    );
  }

  if (error || allStops.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error ?? t('follow.noStops')}</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>{t('plan.goBack')}</Text>
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
        routeSegments={routeSegments}
        activeDayNumber={currentDay}
        followMode
        planId={id}
        packStops={packMapStops}
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
            accessibilityLabel={t('follow.closeMode')}
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

        {fromCache && (
          <View style={s.cachedBadge}>
            <Ionicons name="cloud-offline-outline" size={13} color={colors.textSecondary} />
            <Text style={s.cachedBadgeText}>{t('follow.offlineCached')}</Text>
          </View>
        )}

        <OfflineBanner isOffline={isOffline} />
      </BlurView>

      <View style={s.dayListWrap} pointerEvents="box-none">
        <FollowDaySheet
          allStops={allStops}
          currentIndex={currentIndex}
          onSelect={goTo}
          onChangeDay={handleChangeDay}
          onComplete={handleComplete}
        />
      </View>

      <ConfirmModal
        visible={completeConfirmVisible}
        icon="flag-outline"
        iconColor={colors.sunsetOrange}
        title={t('follow.completeConfirmTitle')}
        body={t('follow.completeConfirmBody')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('follow.completeConfirmCta')}
        onCancel={() => setCompleteConfirmVisible(false)}
        onConfirm={executeComplete}
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
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  cachedBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dayListWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
    zIndex: 10,
  },
});
