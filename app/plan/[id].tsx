import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import type { Plan, PlanStop, PlanDetailResponse, BuilderResponse } from '../../lib/types';

type DayGroup = { dayNumber: number; stops: (PlanStop & { id?: string })[] };

const TIME_BLOCK_ICONS: Record<string, { icon: string; label: string }> = {
  morning: { icon: 'sunny-outline', label: 'Morning' },
  lunch: { icon: 'restaurant-outline', label: 'Lunch' },
  afternoon: { icon: 'cafe-outline', label: 'Afternoon' },
  dinner: { icon: 'moon-outline', label: 'Dinner' },
  evening: { icon: 'musical-notes-outline', label: 'Evening' },
};

function groupStopsByDay(stops: PlanStop[]): DayGroup[] {
  const map = new Map<number, PlanStop[]>();
  for (const stop of stops) {
    const arr = map.get(stop.dayNumber) ?? [];
    arr.push(stop);
    map.set(stop.dayNumber, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNumber, dayStops]) => ({
      dayNumber,
      stops: dayStops.sort((a, b) => a.orderIndex - b.orderIndex),
    }));
}

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === 'preview') {
      const preview = getPreviewPlan();
      if (preview) {
        setPlan(preview.plan);
        setDays(groupStopsByDay(preview.stops));
        setMessage(preview.message);
      } else {
        setError('No plan data available');
      }
      setLoading(false);
      return;
    }

    (async () => {
      const res = await api<PlanDetailResponse>(`/plans/${id}`);
      if (res.data) {
        setPlan(res.data);
        setDays(
          res.data.days.map((d) => ({
            dayNumber: d.dayNumber,
            stops: d.stops.sort((a, b) => a.orderIndex - b.orderIndex),
          })),
        );
      } else {
        setError(res.error ?? 'Failed to load plan');
      }
      setLoading(false);
    })();
  }, [id]);

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
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={s.planName}>{plan.name}</Text>
        <View style={s.badges}>
          <View style={s.badge}>
            <Ionicons name="location-outline" size={14} color={colors.electricBlue} />
            <Text style={s.badgeText}>{plan.city}</Text>
          </View>
          <View style={s.badge}>
            <Ionicons name="calendar-outline" size={14} color={colors.electricBlue} />
            <Text style={s.badgeText}>
              {plan.durationDays} {plan.durationDays === 1 ? 'day' : 'days'}
            </Text>
          </View>
          {plan.type && (
            <View style={[s.badge, { backgroundColor: colors.sunsetOrange + '15' }]}>
              <Text style={[s.badgeText, { color: colors.sunsetOrange }]}>{plan.type}</Text>
            </View>
          )}
        </View>

        {plan.description && <Text style={s.description}>{plan.description}</Text>}

        {/* Builder message */}
        {message && (
          <View style={s.messageCard}>
            <Text style={s.messageText}>{message}</Text>
          </View>
        )}

        {/* Day sections */}
        {days.map((day) => (
          <View key={day.dayNumber} style={s.daySection}>
            <Text style={s.dayTitle}>Day {day.dayNumber}</Text>
            {day.stops.map((stop, idx) => (
              <React.Fragment key={stop.placeId + '-' + idx}>
                <StopCard stop={stop} />
                {idx < day.stops.length - 1 && stop.travelFromPrevious == null && day.stops[idx + 1]?.travelFromPrevious && (
                  <TravelPill travel={day.stops[idx + 1].travelFromPrevious!} />
                )}
                {idx < day.stops.length - 1 && stop.travelFromPrevious != null && idx > 0 && null}
              </React.Fragment>
            ))}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom sticky */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={s.followBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (!isAuthenticated) {
              router.push('/login');
              return;
            }
            const planId = id === 'preview' ? plan.id : id;
            router.push(`/follow/${planId}`);
          }}
        >
          <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
          <Text style={s.followBtnText}>
            {isAuthenticated ? 'Follow this plan' : 'Sign in to follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StopCard({ stop }: { stop: PlanStop }) {
  const tb = stop.timeBlock ? TIME_BLOCK_ICONS[stop.timeBlock] : null;
  const place = stop.place;

  return (
    <View style={s.stopCard}>
      <View style={s.stopHeader}>
        {tb && (
          <Ionicons
            name={tb.icon as any}
            size={18}
            color={colors.sunsetOrange}
            style={{ marginRight: 6 }}
          />
        )}
        {stop.suggestedArrival && (
          <Text style={s.arrivalTime}>{stop.suggestedArrival}</Text>
        )}
      </View>
      <Text style={s.placeName}>{place?.name ?? 'Unknown place'}</Text>
      <View style={s.stopMeta}>
        {place?.category && (
          <View style={s.categoryChip}>
            <Text style={s.categoryText}>{place.category}</Text>
          </View>
        )}
        {place?.neighborhood && (
          <Text style={s.neighborhood}>{place.neighborhood}</Text>
        )}
      </View>
      {place?.whyThisPlace && (
        <Text style={s.whyText}>{place.whyThisPlace}</Text>
      )}
      {stop.suggestedDurationMin != null && (
        <Text style={s.duration}>
          ~{stop.suggestedDurationMin} min
        </Text>
      )}
    </View>
  );
}

function TravelPill({ travel }: { travel: { distance_km: number; duration_min: number; mode: string } }) {
  const modeIcon = travel.mode === 'walk' ? 'walk-outline' : 'car-outline';
  return (
    <View style={s.travelPill}>
      <Ionicons name={modeIcon as any} size={14} color={colors.textSecondary} />
      <Text style={s.travelText}>
        {Math.round(travel.duration_min)} min {travel.mode}
      </Text>
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
  scroll: { padding: spacing.lg, paddingTop: spacing.md },
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

  // Header
  planName: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.electricBlue + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.electricBlue },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Builder message
  messageCard: {
    backgroundColor: colors.sunsetOrange + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  messageText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.deepOcean },

  // Day
  daySection: { marginBottom: spacing.lg },
  dayTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: spacing.md,
  },

  // Stop card
  stopCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  arrivalTime: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.sunsetOrange },
  placeName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
    marginBottom: 4,
  },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  categoryChip: {
    backgroundColor: colors.electricBlue + '12',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.electricBlue },
  neighborhood: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  whyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMain,
    fontStyle: 'italic',
  },
  duration: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Travel pill
  travelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginVertical: 2,
  },
  travelText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.electricBlue,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
  },
  followBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
