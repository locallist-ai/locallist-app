import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView as RNScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getPreviewPlan } from '../../lib/plan-store';
import { PhotoHero } from '../../components/ui/PhotoHero';
import type { Plan, PlanStop, PlanDetailResponse, BuilderResponse } from '../../lib/types';

type DayGroup = { dayNumber: number; stops: (PlanStop & { id?: string })[] };

const HERO_MAX = 250;
const HERO_MIN = 120;

const TIME_BLOCK_ICONS: Record<string, { icon: string; label: string }> = {
  morning: { icon: 'sunny-outline', label: 'Morning' },
  lunch: { icon: 'restaurant-outline', label: 'Lunch' },
  afternoon: { icon: 'cafe-outline', label: 'Afternoon' },
  dinner: { icon: 'moon-outline', label: 'Dinner' },
  evening: { icon: 'musical-notes-outline', label: 'Evening' },
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
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parallax scroll tracking
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Hero animated height: 250 -> 120 as user scrolls
  const heroAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HERO_MAX - HERO_MIN],
      [HERO_MAX, HERO_MIN],
      Extrapolate.CLAMP,
    );
    return { height };
  });

  // Bottom bar entrance spring animation
  const bottomBarVisible = useSharedValue(0);
  const bottomBarAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            bottomBarVisible.value,
            [0, 1],
            [100, 0],
            Extrapolate.CLAMP,
          ),
        },
      ],
      opacity: bottomBarVisible.value,
    };
  });

  // Refs for scrolling to stop cards from gallery thumbnails
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const stopCardPositions = useRef<Record<string, number>>({});

  const scrollToStop = useCallback((placeId: string, idx: number) => {
    const key = `${placeId}-${idx}`;
    const y = stopCardPositions.current[key];
    if (y != null && scrollViewRef.current) {
      (scrollViewRef.current as any).scrollTo({ y, animated: true });
    }
  }, []);

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

  // Trigger bottom bar entrance after data loads
  useEffect(() => {
    if (!loading && plan) {
      bottomBarVisible.value = withSpring(1, {
        damping: 18,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [loading, plan, bottomBarVisible]);

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

  // Determine hero image: plan.image first, then first stop's first photo
  const heroImageUrl =
    plan.image ?? days[0]?.stops[0]?.place?.photos?.[0] ?? undefined;
  const heroFallbackCategory = (plan.category ?? plan.type ?? 'Culture') as
    | 'Food'
    | 'Outdoors'
    | 'Coffee'
    | 'Nightlife'
    | 'Culture'
    | 'Wellness';

  // Build subtitle for hero
  const heroSubtitle = `${plan.city} \u00B7 ${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}${plan.type ? ` \u00B7 ${plan.type}` : ''}`;

  return (
    <View style={s.root}>
      {/* Hero parallax */}
      <Animated.View style={[s.heroContainer, heroAnimatedStyle]}>
        <PhotoHero
          imageUrl={heroImageUrl}
          fallbackCategory={heroFallbackCategory}
          title={plan.name}
          subtitle={heroSubtitle}
          height={HERO_MAX}
        />
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[s.scroll, { paddingTop: HERO_MAX + spacing.md }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Badges below hero */}
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

            {/* Daily photo gallery */}
            <DayPhotoGallery day={day} onThumbnailPress={scrollToStop} />

            {day.stops.map((stop, idx) => (
              <React.Fragment key={stop.placeId + '-' + idx}>
                <View
                  onLayout={(e) => {
                    const key = `${stop.placeId}-${idx}`;
                    stopCardPositions.current[key] = e.nativeEvent.layout.y + HERO_MAX + spacing.md;
                  }}
                >
                  <StopCard stop={stop} />
                </View>
                {idx < day.stops.length - 1 && stop.travelFromPrevious == null && day.stops[idx + 1]?.travelFromPrevious && (
                  <TravelPill travel={day.stops[idx + 1].travelFromPrevious!} />
                )}
                {idx < day.stops.length - 1 && stop.travelFromPrevious != null && idx > 0 && null}
              </React.Fragment>
            ))}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      {/* Bottom sticky with gradient button + spring entrance */}
      <Animated.View style={[s.bottomBar, bottomBarAnimatedStyle]}>
        <TouchableOpacity
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
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.followBtnGradient}
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

/* ---------- Daily Photo Gallery ---------- */

function DayPhotoGallery({
  day,
  onThumbnailPress,
}: {
  day: DayGroup;
  onThumbnailPress: (placeId: string, idx: number) => void;
}) {
  // Collect thumbnails from stops that have photos
  const thumbnails = day.stops
    .map((stop, idx) => ({
      placeId: stop.placeId,
      idx,
      photoUrl: stop.place?.photos?.[0] ?? null,
      category: stop.place?.category ?? 'Culture',
      name: stop.place?.name ?? 'Stop',
    }))
    .filter((t) => t.photoUrl || t.category);

  if (thumbnails.length === 0) return null;

  return (
    <RNScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.dayGalleryContent}
      style={s.dayGallery}
    >
      {thumbnails.map((thumb) => (
        <TouchableOpacity
          key={`${thumb.placeId}-${thumb.idx}`}
          activeOpacity={0.7}
          onPress={() => onThumbnailPress(thumb.placeId, thumb.idx)}
          style={s.dayGalleryItem}
        >
          {thumb.photoUrl ? (
            <Image
              source={{ uri: thumb.photoUrl }}
              style={s.dayGalleryImage}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={getCategoryGradient(thumb.category)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.dayGalleryImage}
            />
          )}
        </TouchableOpacity>
      ))}
    </RNScrollView>
  );
}

/* ---------- Stop Card with Thumbnail ---------- */

function StopCard({ stop }: { stop: PlanStop }) {
  const tb = stop.timeBlock ? TIME_BLOCK_ICONS[stop.timeBlock] : null;
  const place = stop.place;
  const photoUrl = place?.photos?.[0] ?? null;
  const categoryForGradient = place?.category ?? 'Culture';

  return (
    <View style={s.stopCard}>
      <View style={s.stopCardRow}>
        {/* Photo thumbnail or category gradient fallback */}
        <View style={s.stopThumbContainer}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={s.stopThumb}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={getCategoryGradient(categoryForGradient)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.stopThumb}
            />
          )}
        </View>

        {/* Text content */}
        <View style={s.stopTextContent}>
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
        </View>
      </View>

      {/* Full-width content below the row */}
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

/* ---------- Travel Pill (unchanged) ---------- */

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

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scroll: { padding: spacing.lg },
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

  // Hero parallax
  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },

  // Badges
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

  // Day section
  daySection: { marginBottom: spacing.lg },
  dayTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
  },

  // Daily photo gallery
  dayGallery: {
    marginBottom: spacing.md,
  },
  dayGalleryContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  dayGalleryItem: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  dayGalleryImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },

  // Stop card
  stopCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stopCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stopThumbContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  stopThumb: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  stopTextContent: {
    flex: 1,
    minHeight: 60,
    justifyContent: 'center',
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  arrivalTime: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.sunsetOrange },
  placeName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
    marginBottom: 4,
  },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 },
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
    marginTop: spacing.sm,
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
  followBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
  },
  followBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
