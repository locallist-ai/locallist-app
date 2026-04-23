import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { PhotoHero, type Category } from '../ui/PhotoHero';
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
  heroImageUrl?: string;
  onFollow: () => void;
  onEdit?: () => void;
}

const WHY_TRUNCATE = 160;

export const PlanCardPager: React.FC<PlanCardPagerProps> = ({
  plan,
  stops,
  totalStops,
  message,
  isAuthenticated,
  isOwner,
  heroImageUrl,
  onFollow,
  onEdit,
}) => {
  const [slide, setSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const lastHaptic = useRef(0);

  const slotCount = 1 + stops.length;

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
  };

  const goToSlide = (idx: number) => {
    if (idx < 0 || idx >= slotCount) return;
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  const slideLabel = useMemo(() => {
    if (slide === 0) return 'Overview';
    return `Stop ${slide} of ${stops.length}`;
  }, [slide, stops.length]);

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
          totalStops={totalStops}
          message={message}
          heroImageUrl={heroImageUrl}
          isAuthenticated={isAuthenticated}
          isOwner={isOwner}
          onFollow={onFollow}
          onEdit={onEdit}
          onStart={() => goToSlide(1)}
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
        <TouchableOpacity
          disabled={slide === 0}
          onPress={() => goToSlide(slide - 1)}
          style={[styles.navBtn, slide === 0 && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Previous slide"
        >
          <Ionicons name="chevron-back" size={22} color={slide === 0 ? colors.borderColor : colors.deepOcean} />
        </TouchableOpacity>

        <View style={styles.footerCenter}>
          <ProgressDots
            total={slotCount}
            current={slide}
            size="sm"
            colorPending="rgba(15, 23, 42, 0.18)"
          />
          <Text style={styles.slideLabel}>{slideLabel}</Text>
        </View>

        <TouchableOpacity
          disabled={slide === slotCount - 1}
          onPress={() => goToSlide(slide + 1)}
          style={[styles.navBtn, slide === slotCount - 1 && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next slide"
        >
          <Ionicons name="chevron-forward" size={22} color={slide === slotCount - 1 ? colors.borderColor : colors.deepOcean} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* ───── Overview Slot ───── */

interface OverviewSlotProps {
  plan: Plan;
  totalStops: number;
  message?: string | null;
  heroImageUrl?: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  onFollow: () => void;
  onEdit?: () => void;
  onStart: () => void;
}

const OverviewSlot: React.FC<OverviewSlotProps> = React.memo(({
  plan,
  totalStops,
  message,
  heroImageUrl,
  isAuthenticated,
  isOwner,
  onFollow,
  onEdit,
  onStart,
}) => {
  const heroFallback = (plan.category ?? plan.type ?? 'Culture') as Category;
  const heroSubtitle = `${plan.city} · ${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}`;

  return (
    <ScrollView
      style={styles.slot}
      contentContainerStyle={styles.slotContent}
      showsVerticalScrollIndicator={false}
    >
      <PhotoHero
        imageUrl={heroImageUrl}
        fallbackCategory={heroFallback}
        title={plan.name}
        subtitle={heroSubtitle}
        height={260}
        withSafeArea
      />

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <Stat icon="location-outline" text={plan.city} />
          <Dot />
          <Stat icon="calendar-outline" text={`${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}`} />
          <Dot />
          <Stat icon="flag-outline" text={`${totalStops} stops`} />
          {plan.type && (
            <>
              <Dot />
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{plan.type}</Text>
              </View>
            </>
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

        {isOwner && onEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit this plan"
          >
            <Ionicons name="create-outline" size={16} color={colors.sunsetOrange} />
            <Text style={styles.editBtnText}>Edit Plan</Text>
          </TouchableOpacity>
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

        <TouchableOpacity
          onPress={onStart}
          style={styles.browseBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Browse stops"
        >
          <Text style={styles.browseBtnText}>Browse stops</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.deepOcean} />
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
  const [expanded, setExpanded] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const place = stop.place;
  const photos = place?.photos ?? [];
  const activePhoto = photos[photoIdx];
  const fallbackCategory = (place?.category ?? 'Culture') as Category;
  const timeEmoji = stop.timeBlock ? TIME_BLOCK_EMOJI[stop.timeBlock] ?? null : null;
  const why = place?.whyThisPlace ?? '';
  const needsTruncate = why.length > WHY_TRUNCATE;
  const whyDisplay = expanded || !needsTruncate ? why : `${why.slice(0, WHY_TRUNCATE).trim()}…`;

  const chipTokens = useMemo(() => {
    const tokens: string[] = [];
    if (place?.bestTime) tokens.push(place.bestTime);
    if (place?.suitableFor) tokens.push(...place.suitableFor.slice(0, 3));
    if (place?.bestFor) tokens.push(...place.bestFor.slice(0, 2));
    return Array.from(new Set(tokens)).slice(0, 5);
  }, [place]);

  const openMaps = () => {
    if (!place?.latitude || !place?.longitude) {
      Alert.alert('Location unavailable', 'This place does not have coordinates yet.');
      return;
    }
    const query = encodeURIComponent(place.name);
    const url = `https://maps.apple.com/?q=${query}&ll=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

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
            <Text style={styles.whyText}>{whyDisplay}</Text>
            {needsTruncate && (
              <TouchableOpacity
                onPress={() => setExpanded((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.whyToggle}>
                  {expanded ? 'Show less' : 'Show more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={openMaps}
            activeOpacity={0.7}
            style={styles.actionBtn}
            accessibilityRole="button"
            accessibilityLabel="Open in Maps"
          >
            <Ionicons name="map-outline" size={18} color={colors.deepOcean} />
            <Text style={styles.actionBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
});
StopSlot.displayName = 'StopSlot';

/* ───── Subcomponents ───── */

const Stat: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.statItem}>
    <Ionicons name={icon} size={15} color={colors.sunsetOrange} />
    <Text style={styles.statText}>{text}</Text>
  </View>
);

const Dot: React.FC = () => <View style={styles.statDot} />;

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
  },
  slotContent: {
    paddingBottom: 110, // space for footer
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  /* Overview */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 8,
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
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.sunsetOrange + '40',
    backgroundColor: colors.sunsetOrange + '08',
  },
  editBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.sunsetOrange },
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
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  browseBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.deepOcean },

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
  whyToggle: {
    fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.sunsetOrange, marginTop: 4,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  actionBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(242,239,233,0.92)',
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerCenter: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  slideLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
});
