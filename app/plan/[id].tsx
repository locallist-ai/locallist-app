import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import { PlanCardPager } from '../../components/plan/PlanCardPager';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { usePlanEditor } from '../../lib/use-plan-editor';
import type { Plan, PlanStop, PlanDetailResponse } from '../../lib/types';
import type { DayGroup } from '../../lib/use-plan-editor';

function flattenStopsFromDays(days: DayGroup[]): PlanStop[] {
  return days
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .flatMap((d) => d.stops.slice().sort((a, b) => a.orderIndex - b.orderIndex));
}

function sortStopsFlat(stops: PlanStop[]): PlanStop[] {
  return stops.slice().sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    return a.orderIndex - b.orderIndex;
  });
}

function groupStopsByDay(stops: PlanStop[], durationDays: number) {
  const byDay: Record<number, PlanStop[]> = {};
  stops.forEach((s) => {
    const d = s.dayNumber || 1;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  });
  const result = [];
  for (let i = 1; i <= durationDays; i++) {
    result.push({ dayNumber: i, stops: (byDay[i] ?? []).slice().sort((a, b) => a.orderIndex - b.orderIndex) });
  }
  return result as PlanDetailResponse['days'];
}

export default function PlanDetailScreen() {
  const { id, planName, planCity, planDays } = useLocalSearchParams<{
    id: string;
    planName?: string;
    planCity?: string;
    planDays?: string;
  }>();
  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const isNew = id === 'new';
  const newPlanConfig = useMemo(
    () =>
      isNew && planName && planCity
        ? {
            name: planName,
            city: planCity,
            durationDays: Number(planDays) || 2,
          }
        : undefined,
    [isNew, planName, planCity, planDays],
  );

  const [plan, setPlan] = useState<Plan | null>(null);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pending navigation action captured from beforeRemove; executed on discard confirm.
  const pendingAction = useRef<(() => void) | null>(null);

  // Resolves the real plan id (preview → plan.id from backend).
  const effectivePlanId = id === 'preview' ? plan?.id ?? null : id ?? null;

  const isOwner = isNew || !!(user && createdById && user.id === createdById);

  // Editor is active when the user owns this plan. For new plans it's active immediately.
  // For others it activates once ownership is determined post-fetch.
  const editorActive = isNew || (!!effectivePlanId && isOwner);
  const editorPlanId = isNew ? 'new' : editorActive ? effectivePlanId! : '__idle__';

  // Pre-built initialData fed to the editor so it skips a duplicate fetch.
  const editorInitialData: PlanDetailResponse | undefined = useMemo(() => {
    if (isNew || !plan) return undefined;
    return {
      ...(plan as PlanDetailResponse),
      days: groupStopsByDay(stops, plan.durationDays ?? 1),
    };
  }, [isNew, plan, stops]);

  const editor = usePlanEditor(editorPlanId, { newPlanConfig, initialData: editorInitialData });
  const { plan: editorPlan, days: editorDays, isDirty: editorIsDirty, isSaving: editorIsSaving, dispatch: editorDispatch, save: editorSave } = editor;

  // For new plan: loading stays true until editor initializes its plan.
  useEffect(() => {
    if (isNew && editorPlan) setLoading(false);
  }, [isNew, editorPlan]);

  // Fetch plan data (preview store or API).
  useEffect(() => {
    if (isNew) return;

    if (id === 'preview') {
      const preview = getPreviewPlan();
      if (preview) {
        setPlan(preview.plan);
        setStops(sortStopsFlat(preview.stops));
        setMessage(preview.message);
        const ownerId =
          (preview.plan as Plan & { createdById?: string }).createdById ??
          user?.id ??
          null;
        if (ownerId) setCreatedById(ownerId);
      } else {
        setError('No plan data available');
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api<PlanDetailResponse>(`/plans/${id}`);
        if (cancelled) return;
        if (res.data) {
          setPlan(res.data);
          setCreatedById(res.data.createdById ?? null);
          setStops(sortStopsFlat(flattenStopsFromDays(
            res.data.days.map((d) => ({ dayNumber: d.dayNumber, stops: d.stops }))
          )));
        } else {
          setError(res.error ?? 'Failed to load plan');
        }
      } catch {
        if (!cancelled) setError('Network error');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, isNew, user]);

  // Intercept navigation if there are unsaved changes; show discard confirmation.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!editorIsDirty) return;
      e.preventDefault();
      pendingAction.current = () => navigation.dispatch(e.data.action);
      setDiscardVisible(true);
    });
    return unsubscribe;
  }, [navigation, editorIsDirty]);

  // Use editor data as the visible source of truth when the editor is ready.
  const editorReady = editorActive && !!editorPlan && !editor.loading;
  const visiblePlan: Plan | null = isNew
    ? (editorPlan as Plan | null)
    : editorReady
      ? (editorPlan as Plan)
      : plan;
  const visibleStops: PlanStop[] = editorReady
    ? flattenStopsFromDays(editorDays)
    : stops;

  const heroPhotos = useMemo<string[]>(() => {
    const picked: string[] = [];
    const seen = new Set<string>();
    for (const st of visibleStops) {
      const photo = st.place?.photos?.[0];
      if (photo && !seen.has(photo)) {
        picked.push(photo);
        seen.add(photo);
        if (picked.length >= 4) break;
      }
    }
    if (visiblePlan?.image && !seen.has(visiblePlan.image)) {
      picked.unshift(visiblePlan.image);
      if (picked.length > 4) picked.length = 4;
    }
    return picked;
  }, [visiblePlan, visibleStops]);

  const handleEditorSave = useCallback(async () => {
    const result = await editorSave();
    if (!result.success) {
      setSaveError(result.error ?? 'Failed to save');
      return;
    }

    if (isNew && result.planId) {
      router.replace(`/plan/${result.planId}`);
      return;
    }

    // Re-fetch parent state after saving an existing plan.
    const targetId = result.planId ?? effectivePlanId;
    if (targetId) {
      const res = await api<PlanDetailResponse>(`/plans/${targetId}`);
      if (res.data) {
        setPlan(res.data);
        setCreatedById(res.data.createdById ?? null);
        setStops(sortStopsFlat(flattenStopsFromDays(
          res.data.days.map((d) => ({ dayNumber: d.dayNumber, stops: d.stops }))
        )));
      }
    }
  }, [editorSave, effectivePlanId, isNew]);

  const handleFollow = () => {
    if (!isAuthenticated) { router.push('/login'); return; }
    router.push(`/follow/${id === 'preview' ? visiblePlan?.id : id}`);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteVisible(true);
  };

  const confirmDelete = async () => {
    if (deleting || !effectivePlanId) return;
    setDeleting(true);
    const res = await api(`/plans/${effectivePlanId}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteVisible(false);
    if (res.status === 204 || (res.status >= 200 && res.status < 300)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Alert.alert('Delete failed', res.error ?? 'Could not delete this plan. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  if (error || !visiblePlan) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error ?? 'Plan not found'}</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <Text style={s.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: 0 }]}>
      <PlanCardPager
        plan={visiblePlan}
        stops={visibleStops}
        totalStops={visibleStops.length}
        message={message}
        isAuthenticated={isAuthenticated}
        isOwner={isOwner}
        isNew={isNew}
        heroPhotos={heroPhotos}
        onFollow={handleFollow}
        onDelete={!isNew && effectivePlanId && isOwner ? handleDelete : undefined}
        onBack={() => router.back()}
        editorDays={editorDays}
        editorIsDirty={editorIsDirty}
        editorIsSaving={editorIsSaving}
        totalDays={visiblePlan.durationDays ?? editorDays.length}
        onEditorDispatch={editorDispatch}
        onEditorSave={handleEditorSave}
        safeAreaTop={insets.top}
      />

      {/* Discard changes confirm */}
      <ConfirmModal
        visible={discardVisible}
        icon="warning-outline"
        iconColor={colors.sunsetOrange}
        title="Unsaved Changes"
        body="You have unsaved changes. Are you sure you want to leave without saving?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard"
        confirmDestructive
        onCancel={() => {
          setDiscardVisible(false);
          pendingAction.current = null;
        }}
        onConfirm={() => {
          setDiscardVisible(false);
          pendingAction.current?.();
          pendingAction.current = null;
        }}
      />

      {/* Save error */}
      <ConfirmModal
        visible={!!saveError}
        icon="alert-circle-outline"
        iconColor={colors.error}
        title="Save Failed"
        body={saveError ?? ''}
        confirmLabel="OK"
        onCancel={() => setSaveError(null)}
        onConfirm={() => setSaveError(null)}
      />

      {/* Delete confirm */}
      <ConfirmModal
        visible={deleteVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title="Delete this plan?"
        body="This will permanently remove the plan, its stops, and any follow sessions tied to it. This action cannot be undone."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        confirmDestructive
        onCancel={() => {
          if (!deleting) setDeleteVisible(false);
        }}
        onConfirm={confirmDelete}
      />
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
});
