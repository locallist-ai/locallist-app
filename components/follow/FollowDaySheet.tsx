import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { formatPriceLabel } from '../../lib/helpers/price';
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
import { PhotoAttribution } from '../ui/PhotoAttribution';
import { resolvePhotoUrl, isPhotoDisplayable } from '../../lib/helpers/photo-url';
import { buildGeoUrl, resolveHandoffTargets } from '../../lib/map/handoff';
import { getTravelToNextStop, formatDistance, formatDuration } from '../../lib/map/eta';
import { logger } from '../../lib/logger';
import type { PlanStop } from '../../lib/types';

const COLLAPSED_PEEK_HEIGHT = 56;
const COMMIT_THRESHOLD = 0.35;

const CATEGORY_COLOR: Record<string, string> = {
  Food: '#f97316',
  Outdoors: '#10b981',
  Coffee: '#92400e',
  Nightlife: '#1e1b4b',
  Culture: '#0f172a',
  Wellness: '#7c3aed',
};

const CATEGORY_GRADIENT: Record<string, [string, string]> = {
  Food: ['#f97316', '#ea580c'],
  Outdoors: ['#10b981', '#059669'],
  Coffee: ['#92400e', '#78350f'],
  Nightlife: ['#1e1b4b', '#312e81'],
  Culture: ['#0f172a', '#1e293b'],
  Wellness: ['#7c3aed', '#6d28d9'],
};

interface FollowDaySheetProps {
  allStops: PlanStop[];
  currentIndex: number;
  onSelect: (linearIndex: number) => void;
  onChangeDay?: (day: number) => void;
  onComplete?: () => void;
}

export const FollowDaySheet: React.FC<FollowDaySheetProps> = ({
  allStops,
  currentIndex,
  onSelect,
  onChangeDay,
  onComplete,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const currentStop = allStops[currentIndex];
  const currentDay = currentStop?.dayNumber ?? 1;

  const dayItems = useMemo(() => {
    const items: { stop: PlanStop; linearIndex: number }[] = [];
    allStops.forEach((stop, i) => {
      if (stop.dayNumber === currentDay) items.push({ stop, linearIndex: i });
    });
    items.sort((a, b) => a.stop.orderIndex - b.stop.orderIndex);
    return items;
  }, [allStops, currentDay]);

  const allDays = useMemo(() => {
    const days = new Set<number>();
    allStops.forEach((s) => days.add(s.dayNumber));
    return Array.from(days).sort();
  }, [allStops]);

  const [collapsed, setCollapsed] = useState(false);
  const sheetHeight = useSharedValue(0);
  const translateY = useSharedValue(0);

  const onLayoutSheet = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && sheetHeight.value !== h) {
      sheetHeight.value = h;
      if (collapsed) translateY.value = h - COLLAPSED_PEEK_HEIGHT;
    }
  };

  const setCollapsedJS = useCallback((next: boolean) => {
    setCollapsed(next);
    Haptics.selectionAsync();
  }, []);

  const toggleCollapse = useCallback(() => {
    'worklet';
    const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
    const target = translateY.value > max / 2 ? 0 : max;
    translateY.value = withSpring(target, { damping: 22, stiffness: 200 });
    runOnJS(setCollapsedJS)(target !== 0);
  }, [setCollapsedJS, sheetHeight, translateY]);

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        toggleCollapse();
      }),
    [toggleCollapse],
  );

  const panGesture = useMemo(() => {
    const startY = { value: 0 };
    return Gesture.Pan()
      .onStart(() => {
        'worklet';
        startY.value = translateY.value;
      })
      .onChange((e) => {
        'worklet';
        const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
        const next = Math.max(0, Math.min(max, startY.value + e.translationY));
        translateY.value = next;
      })
      .onEnd((e) => {
        'worklet';
        const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
        const fastDown = e.velocityY > 800;
        const fastUp = e.velocityY < -800;
        const past = translateY.value > max * COMMIT_THRESHOLD;
        const target = fastUp ? 0 : fastDown ? max : past ? max : 0;
        translateY.value = withSpring(target, { damping: 22, stiffness: 200, velocity: e.velocityY });
        runOnJS(setCollapsedJS)(target !== 0);
      });
  }, [setCollapsedJS, sheetHeight, translateY]);

  const handleGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Current stop data shortcuts
  const place = currentStop?.place;
  const resolvedPhotoUrl = resolvePhotoUrl(place?.photos?.[0]);
  // Tracks the URL that failed (not a plain boolean): the featured card stays
  // mounted across stops, so a boolean would keep suppressing the photo of
  // the NEXT stop after one failure. Comparing URLs resets it naturally.
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const isValidPhoto = isPhotoDisplayable(resolvedPhotoUrl, failedPhotoUrl);
  const categoryColor = CATEGORY_COLOR[place?.category ?? 'Culture'] ?? '#0f172a';
  const categoryGradient: [string, string] = CATEGORY_GRADIENT[place?.category ?? 'Culture'] ?? ['#0f172a', '#1e293b'];
  const iconName = currentStop?.timeBlock
    ? TIME_BLOCK_ICON[currentStop.timeBlock] ?? DEFAULT_STOP_ICON
    : DEFAULT_STOP_ICON;

  // --- Stop pagination (within the current day) ---
  // The sheet always mirrors `currentIndex`, so the stop shown here is also the
  // one the map centers on. The arrows just move `currentIndex` by ±1 within the
  // day via the existing `onSelect(linearIndex)` contract — no separate "viewing
  // vs following" state exists (changing day/stop moves the session too).
  const dayPosition = dayItems.findIndex((it) => it.linearIndex === currentIndex);
  const safeDayPos = dayPosition >= 0 ? dayPosition : 0;
  const dayStopCount = dayItems.length;
  const hasPrevStop = safeDayPos > 0;
  const hasNextStop = safeDayPos < dayStopCount - 1;

  const goToStop = useCallback(
    (pos: number) => {
      const target = dayItems[pos];
      if (!target) return;
      Haptics.selectionAsync();
      onSelect(target.linearIndex);
    },
    [dayItems, onSelect],
  );

  const handleStopPrev = useCallback(() => {
    if (safeDayPos > 0) goToStop(safeDayPos - 1);
  }, [safeDayPos, goToStop]);

  const handleStopNext = useCallback(() => {
    if (safeDayPos < dayStopCount - 1) goToStop(safeDayPos + 1);
  }, [safeDayPos, dayStopCount, goToStop]);

  // Horizontal swipe to page between stops (arrows are the requirement; this is
  // the cheap natural gesture on top). Fails to the vertical axis so the sheet's
  // collapse pan is never stolen.
  const stopSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .onEnd((e) => {
          'worklet';
          if (e.translationX <= -48) {
            runOnJS(handleStopNext)();
          } else if (e.translationX >= 48) {
            runOnJS(handleStopPrev)();
          }
        }),
    [handleStopNext, handleStopPrev],
  );

  // --- Day stepper ---
  const dayPos = allDays.indexOf(currentDay);
  const multiDay = allDays.length > 1;
  const hasPrevDay = dayPos > 0;
  const hasNextDay = dayPos >= 0 && dayPos < allDays.length - 1;

  const goToDay = useCallback(
    (targetPos: number) => {
      const day = allDays[targetPos];
      if (day == null || !onChangeDay) return;
      Haptics.selectionAsync();
      onChangeDay(day);
    },
    [allDays, onChangeDay],
  );

  // --- ETA planificada al próximo stop del día (datos ya en el modelo, cero
  // backend, cero GPS): `travelFromPrevious` del siguiente stop. ---
  const travelToNext = useMemo(
    () => getTravelToNextStop(dayItems.map((it) => it.stop), safeDayPos),
    [dayItems, safeDayPos],
  );

  // --- Handoff "Cómo llegar": navegación turn-by-turn a pie en la app de mapas
  // del usuario (excepción stay-in-app autorizada desde un Follow activo). ---
  const handleDirections = useCallback(async () => {
    const lat = place?.latitude;
    const lng = place?.longitude;
    if (lat == null || lng == null) return;
    const coord = { latitude: lat, longitude: lng };
    Haptics.selectionAsync();

    const openUrl = async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch {
        try {
          await Linking.openURL(buildGeoUrl(coord));
        } catch (err) {
          logger.warn('follow: no maps app could handle directions handoff', err);
        }
      }
    };

    let googleAvailable = false;
    try {
      googleAvailable = await Linking.canOpenURL('comgooglemaps://');
    } catch {
      googleAvailable = false;
    }

    const targets = resolveHandoffTargets(coord, googleAvailable);
    if (targets.length === 1) {
      await openUrl(targets[0].url);
      return;
    }
    const apple = targets.find((tg) => tg.provider === 'apple');
    const google = targets.find((tg) => tg.provider === 'google');
    Alert.alert(t('follow.directionsTitle'), t('follow.directionsBody'), [
      { text: t('follow.openAppleMaps'), onPress: () => { void (apple && openUrl(apple.url)); } },
      { text: t('follow.openGoogleMaps'), onPress: () => { void (google && openUrl(google.url)); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [place, t]);

  return (
    <Animated.View
      style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }, animatedSheetStyle]}
      onLayout={onLayoutSheet}
    >
      {/* Handle bar — tap or drag to collapse/expand */}
      <GestureDetector gesture={handleGesture}>
        <View
          style={styles.handleBar}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t('follow.expandSheet') : t('follow.collapseSheet')}
        >
          <View style={styles.handle} />
        </View>
      </GestureDetector>

      {/* Day stepper — one centered control: ‹ Day 2 of 3 › */}
      <View style={styles.dayStepperRow}>
        {multiDay && (
          <TouchableOpacity
            onPress={() => goToDay(dayPos - 1)}
            disabled={!hasPrevDay}
            style={[styles.stepperArrow, !hasPrevDay && styles.navArrowDisabled]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasPrevDay }}
            accessibilityLabel={t('follow.prevDay')}
            testID="follow-day-prev"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={hasPrevDay ? colors.deepOcean : colors.borderColor}
            />
          </TouchableOpacity>
        )}
        <Text style={styles.dayStepperLabel} testID="follow-day-stepper-label">
          {t('follow.dayStepper', { current: dayPos >= 0 ? dayPos + 1 : 1, total: allDays.length })}
        </Text>
        {multiDay && (
          <TouchableOpacity
            onPress={() => goToDay(dayPos + 1)}
            disabled={!hasNextDay}
            style={[styles.stepperArrow, !hasNextDay && styles.navArrowDisabled]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasNextDay }}
            accessibilityLabel={t('follow.nextDay')}
            testID="follow-day-next"
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={26}
              color={hasNextDay ? colors.deepOcean : colors.borderColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Paginated stop card — one stop at a time, large, with arrows + swipe */}
      {place ? (
        <GestureDetector gesture={stopSwipeGesture}>
          <View style={styles.featuredCard}>
            {/* Photo / gradient backdrop */}
            <View style={styles.featuredPhoto}>
            <LinearGradient colors={categoryGradient} style={StyleSheet.absoluteFill} />
            {isValidPhoto && (
              <Image
                source={{ uri: resolvedPhotoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={300}
                onError={() => setFailedPhotoUrl(resolvedPhotoUrl)}
              />
            )}
            {isValidPhoto && place.photoSource === 'google' && <PhotoAttribution />}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              style={styles.featuredGradient}
            />
            {/* Arrival pill + category badge */}
            <View style={styles.featuredTopRow}>
              {currentStop?.suggestedArrival && (
                <View style={styles.timePill}>
                  <MaterialCommunityIcons name={iconName} size={12} color={colors.sunsetOrange} />
                  <Text style={styles.timePillText}>{currentStop.suggestedArrival}</Text>
                </View>
              )}
              <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                <Text style={styles.categoryBadgeText}>{place.category}</Text>
              </View>
            </View>
            {/* Name + neighborhood over photo */}
            <View style={styles.featuredNameBlock}>
              <Text style={styles.featuredName} numberOfLines={2}>{place.name}</Text>
              {place.neighborhood && (
                <View style={styles.featuredNeighborhood}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.featuredNeighborhoodText}>{place.neighborhood}</Text>
                </View>
              )}
            </View>
            </View>

            {/* Stop pager — arrows + position indicator (‹ 2 / 4 ›) */}
            <View style={styles.stopPagerRow}>
              <TouchableOpacity
                onPress={handleStopPrev}
                disabled={!hasPrevStop}
                style={[styles.stopArrow, !hasPrevStop && styles.navArrowDisabled]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasPrevStop }}
                accessibilityLabel={t('follow.prevStop')}
                testID="follow-stop-prev"
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={22}
                  color={hasPrevStop ? colors.sunsetOrange : colors.borderColor}
                />
              </TouchableOpacity>
              <Text style={styles.stopPosition} testID="follow-stop-position">
                {t('follow.stopPosition', {
                  current: safeDayPos + 1,
                  total: Math.max(dayStopCount, 1),
                })}
              </Text>
              <TouchableOpacity
                onPress={handleStopNext}
                disabled={!hasNextStop}
                style={[styles.stopArrow, !hasNextStop && styles.navArrowDisabled]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasNextStop }}
                accessibilityLabel={t('follow.nextStop')}
                testID="follow-stop-next"
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={hasNextStop ? colors.sunsetOrange : colors.borderColor}
                />
              </TouchableOpacity>
            </View>

            {/* ETA al próximo stop + handoff a mapas (turn-by-turn) */}
            <View style={styles.followActionsRow}>
              {travelToNext ? (
                <View style={styles.etaPill}>
                  <MaterialCommunityIcons name="walk" size={13} color={colors.deepOcean} />
                  <Text style={styles.etaText} numberOfLines={1}>
                    {`${formatDistance(travelToNext.distanceKm, t)} · ${formatDuration(travelToNext.durationMin, t)}`}
                  </Text>
                  <Text style={styles.etaLabel} numberOfLines={1}>{t('follow.toNextStop')}</Text>
                </View>
              ) : (
                <View style={styles.etaSpacer} />
              )}
              <TouchableOpacity
                style={styles.directionsBtn}
                onPress={handleDirections}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('follow.getDirections')}
                testID="follow-directions"
              >
                <MaterialCommunityIcons name="directions" size={16} color="#FFFFFF" />
                <Text style={styles.directionsBtnText}>{t('follow.getDirections')}</Text>
              </TouchableOpacity>
            </View>

            {/* Metadata + why — scrollable so long content stays reachable in the large card */}
            <ScrollView
              style={styles.cardBody}
              contentContainerStyle={styles.cardBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Metadata strip */}
              <View style={styles.featuredMeta}>
                {typeof place.googleRating === 'number' && place.googleRating > 0 && (
                  <View style={styles.metaPill}>
                    <MaterialCommunityIcons name="star" size={13} color="#b45309" />
                    <Text style={styles.metaPillText}>
                      {place.googleRating.toFixed(1)}
                      {typeof place.googleReviewCount === 'number' && place.googleReviewCount > 0
                        ? ` · ${place.googleReviewCount}`
                        : ''}
                    </Text>
                  </View>
                )}
                {currentStop?.suggestedDurationMin && (
                  <View style={styles.metaPill}>
                    <MaterialCommunityIcons name="clock-outline" size={13} color={colors.deepOcean} />
                    <Text style={styles.metaPillText}>
                      {currentStop.suggestedDurationMin >= 60
                        ? t('stop.visitDurationLong', { h: Math.floor(currentStop.suggestedDurationMin / 60) })
                        : t('stop.visitDuration', { min: currentStop.suggestedDurationMin })}
                    </Text>
                  </View>
                )}
                {place.priceRange && (
                  <View style={[styles.metaPill, styles.pricePill]}>
                    <Text style={styles.pricePillText}>
                      {formatPriceLabel(place.priceRange, t)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Why this place */}
              {place.whyThisPlace?.length > 0 && (
                <View style={styles.featuredWhy}>
                  <Text style={styles.featuredWhyText}>{place.whyThisPlace}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </GestureDetector>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('follow.noStopsToday')}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={onComplete}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
          <Text style={styles.footerBtnPrimaryText}>{t('follow.completeTrip')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    flex: 1,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderColor,
  },

  // --- Featured stop card (paginated: one stop at a time, large) ---
  featuredCard: {
    flex: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.bgMain,
  },
  featuredPhoto: {
    height: 200,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  cardBody: {
    flex: 1,
  },
  cardBodyContent: {
    paddingBottom: spacing.sm,
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
    top: '40%',
  },
  featuredTopRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  timePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  categoryBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featuredNameBlock: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  featuredName: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: '#FFFFFF',
    lineHeight: 26,
  },
  featuredNeighborhood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  featuredNeighborhoodText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  featuredMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  metaPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  pricePill: {
    backgroundColor: '#d1fae5',
  },
  pricePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#059669',
  },
  featuredWhy: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  featuredWhyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // --- Day stepper (centered ‹ Day 2 of 3 ›) ---
  dayStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dayStepperLabel: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.deepOcean,
    textAlign: 'center',
    minWidth: 120,
  },
  stepperArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },

  // --- Stop pager (arrows + position indicator) ---
  stopPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  stopArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunsetOrangeLight,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  stopPosition: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 56,
    textAlign: 'center',
  },
  navArrowDisabled: {
    opacity: 0.4,
  },

  // --- ETA + directions handoff row ---
  followActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 2,
  },
  etaPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  etaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  etaLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  etaSpacer: {
    flex: 1,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.electricBlue,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  directionsBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // --- Empty state ---
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // --- Footer ---
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  footerBtnPrimary: {
    backgroundColor: colors.sunsetOrange,
  },
  footerBtnPrimaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
