import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withSpring,
  FadeInUp,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import { PhotoHero } from '../../components/ui/PhotoHero';
import type { Plan, PlanStop, PlanDetailResponse, BuilderResponse } from '../../lib/types';

type DayGroup = { dayNumber: number; stops: (PlanStop & { id?: string })[] };

const HERO_MAX = 300;
const HERO_MIN = 120;

// Same cover images used in the plans list for visual continuity
const PLAN_COVERS: Record<string, ImageSourcePropType> = {
  'Romantic Weekend in Miami': require('../../assets/images/plans/romantic-weekend.webp'),
  'Foodie Weekend: Best Bites of Miami': require('../../assets/images/plans/foodie-weekend.webp'),
  'Outdoor Adventure Day': require('../../assets/images/plans/outdoor-adventure.webp'),
  'Family Fun in Miami': require('../../assets/images/plans/family-fun.webp'),
  'Culture & Art Crawl': require('../../assets/images/plans/culture-art-crawl.webp'),
};

type Category = 'Food' | 'Outdoors' | 'Coffee' | 'Nightlife' | 'Culture' | 'Wellness';

const CATEGORY_GRADIENTS: Record<Category, [string, string]> = {
  Food: ['#f97316', '#ea580c'],
  Outdoors: ['#10b981', '#059669'],
  Coffee: ['#92400e', '#78350f'],
  Nightlife: ['#1e1b4b', '#312e81'],
  Culture: ['#0f172a', '#1e293b'],
  Wellness: ['#7c3aed', '#6d28d9'],
};

const TIME_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  morning: 'sunny-outline',
  lunch: 'restaurant-outline',
  afternoon: 'cafe-outline',
  dinner: 'moon-outline',
  evening: 'musical-notes-outline',
};

function getCategoryGradient(category?: string): [string, string] {
  if (category && category in CATEGORY_GRADIENTS) {
    return CATEGORY_GRADIENTS[category as Category];
  }
  return CATEGORY_GRADIENTS.Culture;
}

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
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollY.value = event.contentOffset.y; },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, HERO_MAX - HERO_MIN], [HERO_MAX, HERO_MIN], Extrapolate.CLAMP),
  }));

  const bottomBarVisible = useSharedValue(0);
  const bottomBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bottomBarVisible.value, [0, 1], [100, 0], Extrapolate.CLAMP) }],
    opacity: bottomBarVisible.value,
  }));

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

    let cancelled = false;
    (async () => {
      try {
        const res = await api<PlanDetailResponse>(`/plans/${id}`);
        if (cancelled) return;
        if (res.data) {
          setPlan(res.data);
          setCreatedById(res.data.createdById ?? null);
          setDays(res.data.days.map((d) => ({
            dayNumber: d.dayNumber,
            stops: d.stops.sort((a, b) => a.orderIndex - b.orderIndex),
          })));
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

  useEffect(() => {
    if (!loading && plan) {
      bottomBarVisible.value = withSpring(1, { damping: 18, stiffness: 120 });
    }
  }, [loading, plan]);

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

  const localCover = PLAN_COVERS[plan.name];
  const heroImageUrl = plan.image ?? days[0]?.stops[0]?.place?.photos?.[0] ?? undefined;
  const heroFallbackCategory = (plan.category ?? plan.type ?? 'Culture') as Category;
  const heroSubtitle = `${plan.city} \u00B7 ${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}`;
  const totalStops = days.reduce((acc, d) => acc + d.stops.length, 0);

  return (
    <View style={s.root}>
      {/* Hero parallax */}
      <Animated.View style={[s.heroContainer, heroAnimatedStyle]}>
        <PhotoHero
          localImage={localCover}
          imageUrl={heroImageUrl}
          fallbackCategory={heroFallbackCategory}
          title={plan.name}
          subtitle={heroSubtitle}
          height={HERO_MAX}
          withSafeArea
        />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: HERO_MAX + spacing.md }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Quick stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Ionicons name="location-outline" size={16} color={colors.sunsetOrange} />
            <Text style={s.statText}>{plan.city}</Text>
          </View>
          <View style={s.statDot} />
          <View style={s.statItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.sunsetOrange} />
            <Text style={s.statText}>{plan.durationDays} {plan.durationDays === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={s.statDot} />
          <View style={s.statItem}>
            <Ionicons name="flag-outline" size={16} color={colors.sunsetOrange} />
            <Text style={s.statText}>{totalStops} stops</Text>
          </View>
          {plan.type && (
            <>
              <View style={s.statDot} />
              <View style={s.typeBadge}>
                <Text style={s.typeBadgeText}>{plan.type}</Text>
              </View>
            </>
          )}
        </View>

        {plan.description && <Text style={s.description}>{plan.description}</Text>}

        {/* Edit button (owner only) */}
        {isOwner && id !== 'preview' && (
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push(`/plan/edit/${id}`)}
            activeOpacity={0.7}
            accessibilityLabel="Edit this plan"
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={16} color={colors.electricBlue} />
            <Text style={s.editBtnText}>Edit Plan</Text>
          </TouchableOpacity>
        )}

        {/* Builder message */}
        {message && (
          <View style={s.messageCard}>
            <View style={s.messageHeader}>
              <Ionicons name="sparkles" size={16} color={colors.sunsetOrange} />
              <Text style={s.messageLabel}>AI Curator</Text>
            </View>
            <Text style={s.messageText}>{message}</Text>
          </View>
        )}

        {/* Day sections */}
        {days.map((day, dayIdx) => (
          <View key={day.dayNumber} style={s.daySection}>
            {/* Day header */}
            <Animated.View
              entering={FadeInUp.delay(dayIdx * 100).duration(500)}
              style={s.dayHeader}
            >
              <LinearGradient
                colors={[colors.deepOcean, '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.dayBadge}
              >
                <Text style={s.dayBadgeText}>Day {day.dayNumber}</Text>
              </LinearGradient>
              <View style={s.dayLine} />
            </Animated.View>

            {/* Stops */}
            {day.stops.map((stop, idx) => {
              const globalIdx = dayIdx * 10 + idx;
              return (
                <React.Fragment key={stop.placeId + '-' + idx}>
                  <Animated.View entering={FadeInUp.delay(100 + globalIdx * 80).duration(500).springify().damping(16)}>
                    <StopCard stop={stop} />
                  </Animated.View>
                  {idx < day.stops.length - 1 && (
                    <TravelConnector
                      travel={day.stops[idx + 1]?.travelFromPrevious ?? null}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* Bottom CTA */}
      <Animated.View style={[s.bottomBar, bottomBarStyle, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityLabel={isAuthenticated ? 'Follow this plan' : 'Sign in to follow'}
          accessibilityRole="button"
          onPress={() => {
            if (!isAuthenticated) { router.push('/login'); return; }
            router.push(`/follow/${id === 'preview' ? plan.id : id}`);
          }}
        >
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.followBtn}
          >
            <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
            <Text style={s.followBtnText}>
              {isAuthenticated ? 'Follow this plan' : 'Sign in to follow'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* ── Stop Card ── */

function StopCard({ stop }: { stop: PlanStop }) {
  const place = stop.place;
  const photoUrl = place?.photos?.[0] ?? null;
  const categoryForGradient = place?.category ?? 'Culture';
  const timeIcon = stop.timeBlock ? TIME_ICONS[stop.timeBlock] : null;

  return (
    <TouchableOpacity
      style={s.stopCard}
      activeOpacity={0.85}
      onPress={() => {
        if (place) router.push(`/place/${stop.placeId}`);
      }}
      accessibilityLabel={place?.name ?? 'Stop'}
      accessibilityRole="button"
    >
      {/* Photo */}
      <View style={s.stopImageContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={s.stopImage} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={getCategoryGradient(categoryForGradient)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.stopImage}
          />
        )}
        {/* Time badge overlay */}
        {(stop.suggestedArrival || timeIcon) && (
          <View style={s.timeBadge}>
            {timeIcon && <Ionicons name={timeIcon} size={14} color="#FFFFFF" />}
            {stop.suggestedArrival && (
              <Text style={s.timeBadgeText}>{stop.suggestedArrival}</Text>
            )}
          </View>
        )}
        {/* Category chip overlay */}
        {place?.category && (
          <View style={s.categoryOverlay}>
            <Text style={s.categoryOverlayText}>{place.category}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={s.stopContent}>
        <Text style={s.stopName} numberOfLines={1}>{place?.name ?? 'Unknown place'}</Text>

        {place?.neighborhood && (
          <View style={s.stopLocationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={s.stopNeighborhood}>{place.neighborhood}</Text>
          </View>
        )}

        {place?.whyThisPlace && (
          <Text style={s.stopWhy} numberOfLines={2}>{place.whyThisPlace}</Text>
        )}

        <View style={s.stopFooter}>
          {stop.suggestedDurationMin != null && (
            <View style={s.stopDurationChip}>
              <Ionicons name="time-outline" size={12} color={colors.electricBlue} />
              <Text style={s.stopDurationText}>~{stop.suggestedDurationMin} min</Text>
            </View>
          )}
          <View style={s.stopArrow}>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ── Travel Connector ── */

function TravelConnector({ travel }: { travel: { distance_km: number; duration_min: number; mode: string } | null }) {
  const icon = travel?.mode === 'walk' ? 'walk-outline' : 'car-outline';

  return (
    <View style={s.connectorRow}>
      <View style={s.connectorLine} />
      {travel && (
        <View style={s.connectorPill}>
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={13} color={colors.textSecondary} />
          <Text style={s.connectorText}>{Math.round(travel.duration_min)} min</Text>
        </View>
      )}
      <View style={s.connectorLine} />
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1, backgroundColor: colors.bgMain,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  scroll: { paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fonts.body, fontSize: 16, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  backBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.electricBlue },
  backBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#FFFFFF' },

  heroContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    marginBottom: spacing.md, gap: 8,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.deepOcean },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderColor },
  typeBadge: {
    backgroundColor: colors.sunsetOrange + '15',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full,
  },
  typeBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.sunsetOrange },

  description: {
    fontFamily: fonts.body, fontSize: 15, lineHeight: 22,
    color: colors.textSecondary, marginBottom: spacing.md,
  },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, marginBottom: spacing.md,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.electricBlue + '40',
    backgroundColor: colors.electricBlue + '08',
  },
  editBtnText: {
    fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.electricBlue,
  },

  // Builder message
  messageCard: {
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderLeftWidth: 3, borderLeftColor: colors.sunsetOrange,
  },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  messageLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.sunsetOrange },
  messageText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textMain },

  // Day section
  daySection: { marginBottom: spacing.lg },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  dayBadge: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: borderRadius.full,
  },
  dayBadgeText: { fontFamily: fonts.headingSemiBold, fontSize: 15, color: '#FFFFFF' },
  dayLine: { flex: 1, height: 1, backgroundColor: colors.borderColor },

  // Stop card
  stopCard: {
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg,
    overflow: 'hidden', marginBottom: 2,
  },
  stopImageContainer: {
    width: '100%', height: 160, position: 'relative',
  },
  stopImage: { width: '100%', height: '100%' },
  timeBadge: {
    position: 'absolute', top: spacing.sm, left: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  timeBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#FFFFFF' },
  categoryOverlay: {
    position: 'absolute', bottom: spacing.sm, left: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  categoryOverlayText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.deepOcean },

  stopContent: { padding: spacing.md },
  stopName: { fontFamily: fonts.headingSemiBold, fontSize: 18, color: colors.deepOcean, marginBottom: 4 },
  stopLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  stopNeighborhood: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  stopWhy: {
    fontFamily: fonts.body, fontSize: 14, lineHeight: 20,
    color: colors.textMain, fontStyle: 'italic', marginBottom: 8,
  },
  stopFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopDurationChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.electricBlue + '10',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  stopDurationText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.electricBlue },
  stopArrow: { opacity: 0.4 },

  // Travel connector
  connectorRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: spacing.lg,
  },
  connectorLine: { flex: 1, height: 1, backgroundColor: colors.borderColor },
  connectorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.borderColor,
    marginHorizontal: 8,
  },
  connectorText: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.bgMain,
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: borderRadius.lg,
  },
  followBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
