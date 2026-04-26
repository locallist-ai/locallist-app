import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import { PhotoMosaic } from '../ui/PhotoMosaic';
import { CategoryBadge } from '../ui/CategoryBadge';
import { ProgressDots } from '../ui/design-system';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { TIME_BLOCK_EMOJI } from '../../lib/timeBlocks';
import type { Plan, PlanStop } from '../../lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlanCardPagerProps {
  plan: Plan;
  stops: PlanStop[];
  totalStops: number;
  message?: string | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  heroPhotos: string[];
  onFollow: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const PlanCardPager: React.FC<PlanCardPagerProps> = ({
  plan,
  stops,
  totalStops,
  message,
  isAuthenticated,
  isOwner,
  heroPhotos,
  onFollow,
  onEdit,
  onDelete,
}) => {
  const [slide, setSlide] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const lastHaptic = useRef(0);
  const hintPulse = useSharedValue(0);

  const slotCount = 1 + stops.length;
  const hasMoreSlides = slotCount > 1;

  useEffect(() => {
    if (!hasMoreSlides) return;
    const bounceTimer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: 56, animated: true });
      const back = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, animated: true });
      }, 320);
      return () => clearTimeout(back);
    }, 700);
    hintPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      clearTimeout(bounceTimer);
      cancelAnimation(hintPulse);
    };
  }, [hasMoreSlides, hintPulse]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / SCREEN_WIDTH);
    if (next !== slide) {
      setSlide(next);
      if (Date.now() - lastHaptic.current > 200) {
        Haptics.selectionAsync();
        lastHaptic.current = Date.now();
      }
    }
    if (hintVisible) {
      setHintVisible(false);
      cancelAnimation(hintPulse);
    }
  };

  const slideLabel = useMemo(() => {
    if (slide === 0) return 'Overview';
    return `Stop ${slide} of ${stops.length}`;
  }, [slide, stops.length]);

  const hintAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + hintPulse.value * 0.45,
    transform: [{ translateX: hintPulse.value * 6 }],
  }));

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        <OverviewSlot
          plan={plan}
          stops={stops}
          totalStops={totalStops}
          message={message}
          heroPhotos={heroPhotos}
          isAuthenticated={isAuthenticated}
          isOwner={isOwner}
          onFollow={onFollow}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        {stops.map((stop, idx) => (
          <StopSlot
            key={`${stop.placeId}-${idx}`}
            stop={stop}
            index={idx}
            total={stops.length}
          />
        ))}
      </ScrollView>

      <View style={styles.footer} pointerEvents="box-none">
        <View style={styles.footerCenter}>
          <ProgressDots
            total={slotCount}
            current={slide}
            size="sm"
            colorPending="rgba(15, 23, 42, 0.18)"
          />
          <Text style={styles.slideLabel}>{slideLabel}</Text>
        </View>

        {hintVisible && hasMoreSlides && slide === 0 && (
          <Animated.View pointerEvents="none" style={[styles.swipeHint, hintAnimStyle]}>
            <Text style={styles.swipeHintText}>Swipe</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.sunsetOrange} />
            <Ionicons name="chevron-forward" size={16} color={colors.sunsetOrange} style={styles.swipeHintSecondChevron} />
          </Animated.View>
        )}
      </View>
    </View>
  );
};

/* ───── Overview Slot ───── */

interface OverviewSlotProps {
  plan: Plan;
  stops: PlanStop[];
  totalStops: number;
  message?: string | null;
  heroPhotos: string[];
  isAuthenticated: boolean;
  isOwner: boolean;
  onFollow: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const OverviewSlot: React.FC<OverviewSlotProps> = React.memo(({
  plan,
  stops,
  totalStops,
  message,
  heroPhotos,
  isAuthenticated,
  isOwner,
  onFollow,
  onEdit,
  onDelete,
}) => {
  const heroFallback = (plan.category ?? plan.type ?? 'Culture') as Category;
  const heroSubtitle = `${plan.city} · ${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}`;

  // Resumen "What's inside" — agrupa stops por día. Pablo 2026-04-26: "un
  // breve resumen del plan completo" en la página principal del plan.
  const daysSummary = useMemo(() => {
    const byDay = new Map<number, PlanStop[]>();
    for (const stop of stops) {
      const dn = stop.dayNumber || 1;
      const arr = byDay.get(dn) ?? [];
      arr.push(stop);
      byDay.set(dn, arr);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, list]) => ({
        day,
        stops: list.slice().sort((a, b) => a.orderIndex - b.orderIndex),
      }));
  }, [stops]);

  return (
    <ScrollView
      style={styles.slot}
      contentContainerStyle={styles.slotContent}
      showsVerticalScrollIndicator={false}
    >
      <PhotoMosaic
        photos={heroPhotos}
        fallbackCategory={heroFallback}
        height={280}
      />

      <View style={styles.overviewPanel}>
        <Text style={styles.overviewTitle}>{plan.name}</Text>
        <Text style={styles.overviewSubtitle}>{heroSubtitle}</Text>

        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="location-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>{plan.city}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>
              {plan.durationDays} {plan.durationDays === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="flag-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>{totalStops} stops</Text>
          </View>
          {plan.type && (
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{plan.type}</Text>
            </View>
          )}
        </View>

        {plan.description && (
          <Text style={styles.description}>{plan.description}</Text>
        )}

        {message && (
          <View style={styles.messageCard}>
            <View style={styles.messageHeader}>
              <Ionicons name="sparkles" size={16} color={colors.sunsetOrange} />
              <Text style={styles.messageLabel}>AI Curator</Text>
            </View>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Plan summary "What's inside" — breakdown por día con stop names.
          * Pablo 2026-04-26 quiere un resumen rápido del plan completo en la
          * pantalla principal antes de hacer swipe a cada stop. */}
        {daysSummary.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="list-outline" size={16} color={colors.sunsetOrange} />
              <Text style={styles.summaryLabel}>What's inside</Text>
            </View>
            {daysSummary.map((d) => (
              <View key={d.day} style={styles.summaryDayBlock}>
                <Text style={styles.summaryDayTitle}>Day {d.day}</Text>
                {d.stops.map((s, idx) => {
                  const emoji = s.timeBlock ? TIME_BLOCK_EMOJI[s.timeBlock] ?? '·' : '·';
                  const arrival = s.suggestedArrival ? ` · ${s.suggestedArrival}` : '';
                  return (
                    <View key={`${s.placeId}-${idx}`} style={styles.summaryRow}>
                      <Text style={styles.summaryRowEmoji}>{emoji}</Text>
                      <View style={styles.summaryRowText}>
                        <Text style={styles.summaryRowName} numberOfLines={1}>
                          {s.place?.name ?? 'Unknown'}
                        </Text>
                        <Text style={styles.summaryRowMeta} numberOfLines={1}>
                          {s.place?.category ?? ''}
                          {arrival}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {isOwner && (onEdit || onDelete) && (
          <View style={styles.ownerActions}>
            {onEdit && (
              <TouchableOpacity
                style={[styles.editBtn, styles.ownerActionBtn]}
                onPress={onEdit}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Edit this plan"
              >
                <Ionicons name="create-outline" size={16} color={colors.sunsetOrange} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.deleteBtn, styles.ownerActionBtn]}
                onPress={onDelete}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete this plan"
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onFollow}
          style={styles.ctaWrap}
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? 'Follow this plan' : 'Sign in to follow'}
        >
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
            <Text style={styles.ctaText}>
              {isAuthenticated ? 'Start Follow Mode' : 'Sign in to follow'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});
OverviewSlot.displayName = 'OverviewSlot';

/* ───── Stop Slot ───── */

interface StopSlotProps {
  stop: PlanStop;
  index: number;
  total: number;
}

const StopSlot: React.FC<StopSlotProps> = React.memo(({ stop, index, total }) => {
  const [photoIdx, setPhotoIdx] = useState(0);
  const place = stop.place;
  const photos = place?.photos ?? [];
  const activePhoto = photos[photoIdx];
  const fallbackCategory = (place?.category ?? 'Culture') as Category;
  const timeEmoji = stop.timeBlock ? TIME_BLOCK_EMOJI[stop.timeBlock] ?? null : null;
  const why = place?.whyThisPlace ?? '';

  const chipTokens = useMemo(() => {
    const tokens: string[] = [];
    if (place?.bestTime) tokens.push(place.bestTime);
    if (place?.suitableFor) tokens.push(...place.suitableFor.slice(0, 3));
    if (place?.bestFor) tokens.push(...place.bestFor.slice(0, 2));
    return Array.from(new Set(tokens)).slice(0, 5);
  }, [place]);

  return (
    <ScrollView
      style={styles.slot}
      contentContainerStyle={styles.slotContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stopHeroWrap}>
        <PhotoHero
          imageUrl={activePhoto}
          fallbackCategory={fallbackCategory}
          height={260}
          blurBackdrop
        />
        {timeEmoji && (
          <View style={styles.timeOverlay}>
            <Text style={styles.timeOverlayEmoji}>{timeEmoji}</Text>
            {stop.suggestedArrival && (
              <Text style={styles.timeOverlayText}>{stop.suggestedArrival}</Text>
            )}
          </View>
        )}
        <View style={styles.stopCounterOverlay}>
          <Text style={styles.stopCounterText}>
            {index + 1} / {total}
          </Text>
        </View>
        {photos.length > 1 && (
          <View style={styles.photoDots}>
            {photos.slice(0, 6).map((url, i) => (
              <TouchableOpacity
                key={`${stop.placeId}-photo-${url ?? i}`}
                onPress={() => setPhotoIdx(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${i + 1}`}
                style={[styles.photoDot, i === photoIdx && styles.photoDotActive]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.stopMetaTop}>
          <CategoryBadge category={place?.category} size="sm" />
          {place?.neighborhood && (
            <View style={styles.neighRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.neighText}>{place.neighborhood}</Text>
            </View>
          )}
        </View>

        <Text style={styles.stopName}>{place?.name ?? 'Unknown place'}</Text>

        {chipTokens.length > 0 && (
          <View style={styles.chipsRow}>
            {chipTokens.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {(stop.suggestedDurationMin || place?.priceRange || (place?.googleRating ?? 0) > 0 || stop.travelFromPrevious) && (
          <View style={styles.infoRow}>
            {stop.suggestedDurationMin != null && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.electricBlue} />
                <Text style={styles.infoPillText}>~{stop.suggestedDurationMin}m</Text>
              </View>
            )}
            {place?.priceRange && (
              <View style={[styles.infoPill, styles.pricePill]}>
                <Text style={styles.pricePillText}>{place.priceRange}</Text>
              </View>
            )}
            {typeof place?.googleRating === 'number' && place.googleRating > 0 && (
              <View style={[styles.infoPill, styles.ratingPill]}>
                <MaterialCommunityIcons name="star" size={13} color="#b45309" />
                <Text style={styles.ratingPillText}>
                  {place.googleRating.toFixed(1)}
                  {typeof place.googleReviewCount === 'number' && place.googleReviewCount > 0
                    ? ` · ${place.googleReviewCount}`
                    : ''}
                </Text>
              </View>
            )}
            {stop.travelFromPrevious && stop.travelFromPrevious.duration_min > 0 && (
              <View style={[styles.infoPill, styles.travelPill]}>
                <MaterialCommunityIcons
                  name={stop.travelFromPrevious.mode === 'walk' ? 'walk' : 'car'}
                  size={13}
                  color="#0369a1"
                />
                <Text style={styles.travelPillText}>
                  {Math.round(stop.travelFromPrevious.duration_min)}m
                </Text>
              </View>
            )}
          </View>
        )}

        {why.length > 0 && (
          <View style={styles.whyBlock}>
            <Text style={styles.sectionLabel}>Why this place</Text>
            <Text style={styles.whyText}>{why}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
});
StopSlot.displayName = 'StopSlot';

/* ───── Styles ───── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  scroll: {
    flex: 1,
  },
  slot: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.bgCard,
  },
  slotContent: {
    flexGrow: 1,
    paddingBottom: 110, // space for footer
    backgroundColor: colors.bgCard,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
  },

  /* Overview */
  overviewPanel: {
    marginTop: -24,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  overviewTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.deepOcean,
  },
  overviewSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.sunsetOrange + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  typePill: {
    backgroundColor: colors.deepOcean,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  typePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMain,
  },
  messageCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.sunsetOrange,
  },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  messageLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.sunsetOrange },
  messageText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMain },
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    gap: spacing.sm,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryDayBlock: { gap: 6 },
  summaryDayTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  summaryRowEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  summaryRowText: { flex: 1 },
  summaryRowName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  summaryRowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ownerActionBtn: {
    flex: 1,
  },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.sunsetOrange + '40',
    backgroundColor: colors.sunsetOrange + '08',
  },
  editBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.sunsetOrange },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error + '40',
    backgroundColor: colors.error + '08',
  },
  deleteBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.error },
  ctaWrap: { marginTop: spacing.xs },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: borderRadius.lg,
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },

  /* Stop hero overlays */
  stopHeroWrap: {
    position: 'relative',
  },
  timeOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  timeOverlayEmoji: { fontSize: 14 },
  timeOverlayText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.deepOcean },
  stopCounterOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  stopCounterText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#FFFFFF' },
  photoDots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },

  /* Stop content */
  stopMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  neighText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  stopName: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.deepOcean,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.sunsetOrange + '35',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.deepOcean,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.electricBlue + '10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  infoPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.electricBlue,
  },
  pricePill: { backgroundColor: colors.successEmerald + '15' },
  pricePillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#059669' },
  ratingPill: { backgroundColor: '#fffbeb' },
  ratingPillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#b45309' },
  travelPill: { backgroundColor: '#e0f2fe' },
  travelPillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: '#0369a1' },

  whyBlock: {
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  whyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMain },

  /* Footer */
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  slideLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeHint: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sunsetOrange + '18',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  swipeHintText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    marginRight: 4,
  },
  swipeHintSecondChevron: {
    marginLeft: -10,
    opacity: 0.6,
  },
});
