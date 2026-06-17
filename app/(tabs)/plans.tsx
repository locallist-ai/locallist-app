import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Image, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { router, useNavigation, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../lib/theme';
import { api } from '../../lib/api';
import { useApiState } from '../../lib/use-api-state';
import { runBulkWithConcurrency } from '../../lib/plan/bulk-ops';
import { useAuth } from '../../lib/auth';
import { getCached, setCache, isFresh } from '../../lib/api-cache';
import { HeroSkiaBg } from '../../components/home/HeroSkiaBg';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { ChooserMode } from '../../components/plan/ChooserMode';
import { MineMode } from '../../components/plan/MineMode';
import { CuratedMode } from '../../components/plan/CuratedMode';
import type { Plan } from '../../lib/types';

const PLANS_CACHE_KEY = 'plans_showcase';

/** Sort plans with "Family Fun in Miami" pinned first */
function sortPlans(list: Plan[]): Plan[] {
  return [...list].sort((a, b) => {
    if (a.name === 'Family Fun in Miami') return -1;
    if (b.name === 'Family Fun in Miami') return 1;
    return 0;
  });
}

type PlansMode = 'chooser' | 'curated' | 'mine';

export default function PlansScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [mode, setMode] = useState<PlansMode>('chooser');
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  // Pablo 2026-04-27: multi-select para borrar planes en grupo desde mine.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Audit follow-up D1 (2026-04-27): mount guard contra setState tras unmount
  // durante bulk delete (Promise.all de N requests + refresh). User puede tab
  // away mientras DELETE está in-flight.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshMyPlans = useCallback(async () => {
    const res = await api<{ plans: Plan[] }>('/plans/mine');
    if (!isMountedRef.current) return;
    if (res.data) setMyPlans(res.data.plans ?? []);
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Salir del selection mode al cambiar de modo (ej. usuario va a chooser).
  useEffect(() => {
    if (mode !== 'mine' && selectionMode) exitSelection();
  }, [mode, selectionMode, exitSelection]);

  const enterSelection = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (bulkDeleting) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    // Audit follow-up D1: cap concurrencia a 3 (rate-limit global del backend
    // es 100/min/IP — un Promise.all sin cap con 10+ planes puede squeeze al
    // resto de tráfico del cliente). Lógica extraída a runBulkWithConcurrency
    // para que sea testable sin React.
    const { failed: failedIds } = await runBulkWithConcurrency(
      ids,
      async (id) => {
        const res = await api(`/plans/${id}`, { method: 'DELETE' });
        return res.status >= 200 && res.status < 300;
      },
      3,
    );
    if (!isMountedRef.current) return;
    setBulkDeleting(false);
    setBulkDeleteVisible(false);
    const failed = failedIds.length;
    if (failed > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Mantén failed seleccionados para que el user pueda retry. Limpia los
      // que sí salieron del selection set.
      setSelectedIds(new Set(failedIds));
      Alert.alert(
        t('plans.selectionPartialFailureTitle', { count: failed }),
        t('plans.selectionPartialFailureBody'),
        [{ text: t('plans.selectionPartialFailureOk'), style: 'default' }],
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      exitSelection();
    }
    await refreshMyPlans();
  }, [bulkDeleting, selectedIds, exitSelection, refreshMyPlans, t]);

  // Fetch user's plans when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      refreshMyPlans();
    }, [isAuthenticated, refreshMyPlans])
  );

  // El header nativo se queda oculto en TODOS los modos para que el bg hero
  // se vea full-screen. El back/close de mine/curated se renderiza como
  // floating pill encima del bg.
  useEffect(() => {
    navigation.setOptions({ headerShown: false, headerLeft: undefined });
  }, [navigation]);

  // Stale-while-revalidate: show cached data instantly (preloaded during splash).
  // useApiState conserva la cache en fallo de revalidación y solo expone error
  // cuando no hay data que mostrar.
  const cached = getCached<Plan[]>(PLANS_CACHE_KEY);
  const {
    data: plansData,
    loading,
    refreshing,
    error,
    refresh: onRefresh,
  } = useApiState<Plan[]>(
    async () => {
      const res = await api<{ plans: Plan[] }>('/plans?showcase=true');
      if (!res.data) return { data: null, error: res.error ?? t('plans.loadError') };
      return { data: sortPlans(res.data.plans ?? []), error: null };
    },
    {
      initialData: cached ?? undefined,
      skip: !!cached && isFresh(PLANS_CACHE_KEY),
      // En onSuccess y no en el fetcher: los resultados descartados por
      // out-of-order no deben escribir la cache.
      onSuccess: (list) => setCache(PLANS_CACHE_KEY, list),
    },
  );
  const plans = plansData ?? [];

  // Row handlers for "my plans" (depend on selectionMode → live in orchestrator).
  const handleRowPress = (id: string) => {
    if (selectionMode) toggleSelected(id);
    else router.push(`/plan/${id}`);
  };
  const handleRowLongPress = (id: string) => {
    if (!selectionMode) enterSelection(id);
  };

  if (loading && mode === 'curated') {
    return (
      <View style={s.root}>
        <View style={s.skeletonContainer}>
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[s.heroBgImage, { width: screenWidth + 200, height: screenHeight + 300 }]}
        resizeMode="cover"
      />
      <HeroSkiaBg />
      <View style={s.heroBgOverlay} />

      {mode === 'chooser' && (
        <ChooserMode
          insets={insets}
          isAuthenticated={isAuthenticated}
          myPlansCount={myPlans.length}
          onExploreCurated={() => {
            setMode('curated');
            if (!cached) onRefresh();
          }}
          onBuildOwn={() => router.push('/builder/custom')}
          onImportVideo={() => router.push('/builder/import-video')}
          onMyPlans={() => setMode('mine')}
        />
      )}

      {mode === 'mine' && (
        <MineMode
          insets={insets}
          myPlans={myPlans}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          bulkDeleteVisible={bulkDeleteVisible}
          bulkDeleting={bulkDeleting}
          onBack={() => (selectionMode ? exitSelection() : setMode('chooser'))}
          onRowPress={handleRowPress}
          onRowLongPress={handleRowLongPress}
          onExitSelection={exitSelection}
          onRequestBulkDelete={() => setBulkDeleteVisible(true)}
          onConfirmBulkDelete={confirmBulkDelete}
          onCancelBulkDelete={() => {
            if (!bulkDeleting) setBulkDeleteVisible(false);
          }}
        />
      )}

      {mode === 'curated' && (
        <CuratedMode
          insets={insets}
          plans={plans}
          error={error}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onBack={() => setMode('chooser')}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  heroBgImage: {
    position: 'absolute',
    top: -100,
    left: -100,
  },
  heroBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
