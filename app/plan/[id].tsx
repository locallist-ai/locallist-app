import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import { PlanCardPager } from '../../components/plan/PlanCardPager';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import type { Plan, PlanStop, PlanDetailResponse } from '../../lib/types';

function flattenStopsFromDays(days: { dayNumber: number; stops: PlanStop[] }[]): PlanStop[] {
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

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id === 'preview') {
      const preview = getPreviewPlan();
      if (preview) {
        setPlan(preview.plan);
        setStops(sortStopsFlat(preview.stops));
        setMessage(preview.message);
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
          setStops(flattenStopsFromDays(res.data.days));
        } else {
          setError(res.error ?? 'Failed to load plan');
        }
      } catch {
        if (!cancelled) setError('Network error');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Build the hero mosaic: up to 4 unique photos, drawn from diverse stops
  // (first photo of different stops, then plan.image if present and not already
  // included). This avoids the hero being identical to the first stop's image
  // while still reflecting places that actually appear in the plan.
  const heroPhotos = useMemo<string[]>(() => {
    const picked: string[] = [];
    const seen = new Set<string>();
    for (const st of stops) {
      const photo = st.place?.photos?.[0];
      if (photo && !seen.has(photo)) {
        picked.push(photo);
        seen.add(photo);
        if (picked.length >= 4) break;
      }
    }
    if (plan?.image && !seen.has(plan.image)) {
      picked.unshift(plan.image);
      if (picked.length > 4) picked.length = 4;
    }
    return picked;
  }, [plan, stops]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  if (error || !plan) {
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

  const isOwner = !!(user && createdById && user.id === createdById);
  const totalStops = stops.length;

  const handleFollow = () => {
    if (!isAuthenticated) { router.push('/login'); return; }
    router.push(`/follow/${id === 'preview' ? plan.id : id}`);
  };

  const handleEdit = () => {
    router.push(`/plan/edit/${id}`);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteVisible(true);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const res = await api(`/plans/${id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteVisible(false);
    if (res.status === 204 || (res.status >= 200 && res.status < 300)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else {
      Alert.alert('Delete failed', res.error ?? 'Could not delete this plan. Please try again.');
    }
  };

  return (
    <View style={[s.root, { paddingTop: 0 }]}>
      <TouchableOpacity
        style={[s.backPill, { top: insets.top + spacing.xs }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color={colors.deepOcean} />
      </TouchableOpacity>

      <PlanCardPager
        plan={plan}
        stops={stops}
        totalStops={totalStops}
        message={message}
        isAuthenticated={isAuthenticated}
        isOwner={isOwner && id !== 'preview'}
        heroPhotos={heroPhotos}
        onFollow={handleFollow}
        onEdit={id !== 'preview' ? handleEdit : undefined}
        onDelete={id !== 'preview' && isOwner ? handleDelete : undefined}
      />

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
  backPill: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
