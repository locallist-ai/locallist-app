import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
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
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
import { DaySection } from '../plan-editor/DaySection';
import { MoveToDay } from '../plan-editor/MoveToDay';
import { PlaceSearchModal } from '../plan-editor/PlaceSearchModal';
import type { Plan, PlanStop } from '../../lib/types';
import type { DayGroup } from '../../lib/use-plan-editor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlanCardPagerProps {
  plan: Plan;
  stops: PlanStop[];
  totalStops: number;
  message?: string | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isNew?: boolean;
  heroPhotos: string[];
  onFollow: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  editorDays?: DayGroup[];
  editorIsDirty?: boolean;
  editorIsSaving?: boolean;
  onEditorDispatch?: (action: any) => void;
  onEditorSave?: () => Promise<void>;
  totalDays?: number;
  safeAreaTop?: number;
}

export const PlanCardPager: React.FC<PlanCardPagerProps> = ({
  plan,
  stops,
  totalStops,
  message,
  isAuthenticated,
  isOwner,
  isNew = false,
  heroPhotos,
  onFollow,
  onDelete,
  onBack,
  editorDays = [],
  editorIsDirty = false,
  editorIsSaving = false,
  onEditorDispatch,
  onEditorSave,
  totalDays,
  safeAreaTop = 0,
}) => {
  const [slide, setSlide] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const lastHaptic = useRef(0);
  const hintPulse = useSharedValue(0);

  // For non-owner read-only view: day chip filter
  const allDays = useMemo(() => {
    const set = new Set<number>();
    stops.forEach((s) => set.add(s.dayNumber || 1));
    return Array.from(set).sort((a, b) => a - b);
  }, [stops]);
  const [currentDay, setCurrentDay] = useState<number>(allDays[0] ?? 1);
  useEffect(() => {
    if (allDays.length > 0 && !allDays.includes(currentDay)) {
      setCurrentDay(allDays[0]);
    }
  }, [allDays, currentDay]);

  // Modals hoisted here so they render above the horizontal pager
  const [moveState, setMoveState] = useState({ visible: false, fromDay: 0, stopIndex: 0 });
  const [addState, setAddState] = useState({ visible: false, dayNumber: 1 });

  const slotCount = 1 + stops.length;
  const hasMoreSlides = slotCount > 1;
  const isMultiDay = stops.some((s) => s.dayNumber !== stops[0]?.dayNumber);

  useEffect(() => {
    if (!hasMoreSlides || isOwner) return;
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
  }, [hasMoreSlides, isOwner, hintPulse]);

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
    const stop = stops[slide - 1];
    if (!stop) return '';
    const total = stops.length;
    const dayLabel = isMultiDay ? `Day ${stop.dayNumber} · ` : '';
    return `${dayLabel}Stop ${slide} of ${total}`;
  }, [slide, stops, isMultiDay]);

  const handleDayChange = (day: number) => {
    Haptics.selectionAsync();
    if (day !== currentDay) setCurrentDay(day);
  };

  // Scroll to a stop slide by its global index in `stops`.
  const handleScrollToStop = (globalStopIndex: number) => {
    const targetSlide = globalStopIndex + 1; // slide 0 = overview
    Haptics.selectionAsync();
    setSlide(targetSlide);
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * targetSlide, animated: true });
  };

  const handleBackPress = () => {
    if (slide > 0) {
      Haptics.selectionAsync();
      setSlide(0);
      scrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    onBack?.();
  };

  const hintAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + hintPulse.value * 0.45,
    transform: [{ translateX: hintPulse.value * 6 }],
  }));

  const effectiveTotalDays = totalDays ?? plan.durationDays ?? Math.max(...editorDays.map((d) => d.dayNumber), 1);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={!isOwner}
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
          isNew={isNew}
          onFollow={onFollow}
          onDelete={onDelete}
          editorDays={editorDays}
          editorIsDirty={editorIsDirty}
          editorIsSaving={editorIsSaving}
          onEditorDispatch={onEditorDispatch}
          onEditorSave={onEditorSave}
          onRequestMove={(fromDay, stopIndex) => setMoveState({ visible: true, fromDay, stopIndex })}
          onRequestAdd={(dayNumber) => setAddState({ visible: true, dayNumber })}
          onScrollToStop={handleScrollToStop}
          currentDay={currentDay}
          allDays={allDays}
          onDayChange={handleDayChange}
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

        {hintVisible && hasMoreSlides && slide === 0 && !isOwner && (
          <Animated.View pointerEvents="none" style={[styles.swipeHint, hintAnimStyle]}>
            <Text style={styles.swipeHintText}>Swipe</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.sunsetOrange} />
            <Ionicons name="chevron-forward" size={16} color={colors.sunsetOrange} style={styles.swipeHintSecondChevron} />
          </Animated.View>
        )}
      </View>

      {onBack && (
        <TouchableOpacity
          style={[styles.backPill, { top: safeAreaTop + spacing.xs }]}
          onPress={handleBackPress}
          accessibilityRole="button"
          accessibilityLabel={slide > 0 ? 'Back to overview' : 'Go back'}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.deepOcean} />
        </TouchableOpacity>
      )}

      {/* Modals rendered above the pager */}
      <MoveToDay
        visible={moveState.visible}
        currentDay={moveState.fromDay}
        totalDays={effectiveTotalDays}
        onSelect={(toDay) => {
          onEditorDispatch?.({
            type: 'MOVE_TO_DAY',
            fromDay: moveState.fromDay,
            stopIndex: moveState.stopIndex,
            toDay,
          });
          setMoveState({ ...moveState, visible: false });
        }}
        onClose={() => setMoveState({ ...moveState, visible: false })}
      />
      <PlaceSearchModal
        visible={addState.visible}
        city={plan.city}
        onSelect={(place) => {
          onEditorDispatch?.({ type: 'ADD_STOP', dayNumber: addState.dayNumber, place });
          setAddState({ ...addState, visible: false });
        }}
        onClose={() => setAddState({ ...addState, visible: false })}
      />
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
  isNew: boolean;
  onFollow: () => void;
  onDelete?: () => void;
  editorDays: DayGroup[];
  editorIsDirty: boolean;
  editorIsSaving: boolean;
  onEditorDispatch?: (action: any) => void;
  onEditorSave?: () => Promise<void>;
  onRequestMove: (fromDay: number, stopIndex: number) => void;
  onRequestAdd: (dayNumber: number) => void;
  onScrollToStop: (globalStopIndex: number) => void;
  // read-only (non-owner)
  currentDay: number;
  allDays: number[];
  onDayChange: (day: number) => void;
}

const OverviewSlot: React.FC<OverviewSlotProps> = React.memo(({
  plan,
  stops,
  totalStops,
  message,
  heroPhotos,
  isAuthenticated,
  isOwner,
  isNew,
  onFollow,
  onDelete,
  editorDays,
  editorIsDirty,
  editorIsSaving,
  onEditorDispatch,
  onEditorSave,
  onRequestMove,
  onRequestAdd,
  onScrollToStop,
  currentDay,
  allDays,
  onDayChange,
}) => {
  const heroFallback = (plan.category ?? plan.type ?? 'Culture') as Category;
  const heroSubtitle = `${plan.city} · ${plan.durationDays} ${plan.durationDays === 1 ? 'day' : 'days'}`;

  const stopsForCurrentDay = useMemo(
    () =>
      stops
        .filter((s) => (s.dayNumber || 1) === currentDay)
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [stops, currentDay],
  );

  const dispatch = onEditorDispatch ?? (() => {});

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

        {/* What's inside */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="list-outline" size={16} color={colors.sunsetOrange} />
            <Text style={styles.summaryLabel}>{"What's inside"}</Text>
          </View>

          {isOwner ? (
            /* ── Owner: inline editor ── */
            <>
              {totalStops === 0 && (
                <Animated.View entering={FadeInDown.duration(400).springify().damping(16)} style={styles.editorEmpty}>
                  <View style={styles.editorEmptyIcon}>
                    <Ionicons name="compass-outline" size={32} color={colors.sunsetOrange} />
                  </View>
                  <Text style={styles.editorEmptyTitle}>No stops yet</Text>
                  <Text style={styles.editorEmptyBody}>
                    {'Tap "+ Add a stop" on any day to start building your itinerary.'}
                  </Text>
                </Animated.View>
              )}
              <View style={styles.editorDays}>
                {editorDays.reduce<{ offset: number; nodes: React.ReactNode[] }>(
                  (acc, day, dayIdx) => {
                    const dayOffset = acc.offset;
                    acc.nodes.push(
                      <Animated.View
                        key={day.dayNumber}
                        entering={FadeInDown.delay(dayIdx * 60).duration(350).springify().damping(16)}
                      >
                        <DaySection
                          dayNumber={day.dayNumber}
                          stops={day.stops}
                          onReorder={(from, to) =>
                            dispatch({ type: 'REORDER', dayNumber: day.dayNumber, from, to })
                          }
                          onDeleteStop={(stopIndex) =>
                            dispatch({ type: 'DELETE_STOP', dayNumber: day.dayNumber, stopIndex })
                          }
                          onMoveStop={editorDays.length > 1 ? (stopIndex) => onRequestMove(day.dayNumber, stopIndex) : undefined}
                          onAddPress={() => onRequestAdd(day.dayNumber)}
                          onStopPress={(localIdx) => onScrollToStop(dayOffset + localIdx)}
                        />
                      </Animated.View>
                    );
                    acc.offset += day.stops.length;
                    return acc;
                  },
                  { offset: 0, nodes: [] },
                ).nodes}
              </View>
            </>
          ) : (
            /* ── Non-owner: read-only summary ── */
            <>
              {allDays.length > 1 && (
                <View style={styles.summaryDayChips}>
                  {allDays.map((d) => {
                    const active = d === currentDay;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => onDayChange(d)}
                        activeOpacity={0.85}
                        style={[styles.summaryDayChip, active && styles.summaryDayChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Day ${d}`}
                      >
                        <Text style={[styles.summaryDayChipText, active && styles.summaryDayChipTextActive]}>
                          Day {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {stopsForCurrentDay.map((s, idx) => {
                const rowIcon = s.timeBlock ? TIME_BLOCK_ICON[s.timeBlock] ?? DEFAULT_STOP_ICON : DEFAULT_STOP_ICON;
                const arrival = s.suggestedArrival ? ` · ${s.suggestedArrival}` : '';
                return (
                  <View key={`${s.placeId}-${idx}`} style={styles.summaryRow}>
                    <View style={styles.summaryRowBubble}>
                      <MaterialCommunityIcons name={rowIcon} size={14} color={colors.sunsetOrange} />
                    </View>
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
            </>
          )}
        </View>

        {/* Owner actions: Save + Delete */}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                styles.ownerActionBtn,
                ((!editorIsDirty && !isNew) || editorIsSaving) && styles.saveBtnDisabled,
              ]}
              disabled={(!editorIsDirty && !isNew) || editorIsSaving}
              onPress={onEditorSave}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isNew ? 'Create plan' : 'Save changes'}
            >
              {editorIsSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>{isNew ? 'Create plan' : 'Save changes'}</Text>
                </>
              )}
            </TouchableOpacity>

            {!isNew && onDelete && (
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

        {editorIsDirty && (
          <View style={styles.dirtyBadge}>
            <Ionicons name="alert-circle" size={14} color={colors.sunsetOrange} />
            <Text style={styles.dirtyBadgeText}>Unsaved changes</Text>
          </View>
        )}

        {/* Follow CTA — hidden for new unsaved plans */}
        {!isNew && (
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
        )}
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
  const timeIcon = stop.timeBlock ? TIME_BLOCK_ICON[stop.timeBlock] ?? null : null;
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
        {timeIcon && (
          <View style={styles.timeOverlay}>
            <View style={styles.timeOverlayBubble}>
              <MaterialCommunityIcons name={timeIcon} size={12} color={colors.sunsetOrange} />
            </View>
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
  summaryDayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  summaryDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
  },
  summaryDayChipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  summaryDayChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  summaryDayChipTextActive: {
    color: '#FFFFFF',
  },
  slot: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.bgCard,
  },
  slotContent: {
    flexGrow: 1,
    paddingBottom: 110,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  summaryRowBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  /* Editor inline */
  editorDays: {
    gap: spacing.xs,
  },
  editorEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  editorEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sunsetOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  editorEmptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepOcean,
  },
  editorEmptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
  },

  /* Owner actions */
  ownerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ownerActionBtn: {
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    backgroundColor: colors.sunsetOrange,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error + '40',
    backgroundColor: colors.error + '08',
  },
  deleteBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.error },
  dirtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  dirtyBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
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
  timeOverlayBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
