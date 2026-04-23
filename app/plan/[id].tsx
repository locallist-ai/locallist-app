import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import { PlanCardPager } from '../../components/plan/PlanCardPager';
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

  const heroImageUrl = useMemo(() => {
    if (!plan) return undefined;
    if (plan.image) return plan.image;
    const firstPhoto = stops[0]?.place?.photos?.[0];
    return firstPhoto ?? undefined;
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
        heroImageUrl={heroImageUrl}
        onFollow={handleFollow}
        onEdit={id !== 'preview' ? handleEdit : undefined}
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
