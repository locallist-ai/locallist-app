import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
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
  const photoUrl = place?.photos?.[0];
  const isValidPhoto = photoUrl?.startsWith('https://');
  const categoryColor = CATEGORY_COLOR[place?.category ?? 'Culture'] ?? '#0f172a';
  const categoryGradient: [string, string] = CATEGORY_GRADIENT[place?.category ?? 'Culture'] ?? ['#0f172a', '#1e293b'];
  const iconName = currentStop?.timeBlock
    ? TIME_BLOCK_ICON[currentStop.timeBlock] ?? DEFAULT_STOP_ICON
    : DEFAULT_STOP_ICON;

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

      {/* Featured card — current stop with photo, name, rating, why */}
      {place && (
        <View style={styles.featuredCard}>
          {/* Photo / gradient backdrop */}
          <View style={styles.featuredPhoto}>
            {isValidPhoto ? (
              <Image
                source={{ uri: photoUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <LinearGradient colors={categoryGradient} style={StyleSheet.absoluteFill} />
            )}
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
                  {currentStop.suggestedDurationMin < 60
                    ? `${currentStop.suggestedDurationMin}m`
                    : `${Math.floor(currentStop.suggestedDurationMin / 60)}h`}
                </Text>
              </View>
            )}
            {place.priceRange && (
              <View style={[styles.metaPill, styles.pricePill]}>
                <Text style={styles.pricePillText}>{place.priceRange}</Text>
              </View>
            )}
          </View>

          {/* Why this place */}
          {place.whyThisPlace?.length > 0 && (
            <View style={styles.featuredWhy}>
              <Text style={styles.featuredWhyText} numberOfLines={2}>{place.whyThisPlace}</Text>
            </View>
          )}
        </View>
      )}

      {/* Day switcher */}
      <View style={styles.daySwitcherRow}>
        <Text style={styles.dayTitle}>{t('follow.dayLabel', { day: currentDay })}</Text>
        {allDays.length > 1 && (
          <View style={styles.daySwitcher}>
            {allDays.map((d) => {
              const active = d === currentDay;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => {
                    if (active || !onChangeDay) return;
                    Haptics.selectionAsync();
                    onChangeDay(d);
                  }}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('follow.dayLabel', { day: d })}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Stop navigation list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {dayItems.map(({ stop, linearIndex }, idx) => {
          const isActive = linearIndex === currentIndex;
          const stopIcon = stop.timeBlock
            ? TIME_BLOCK_ICON[stop.timeBlock] ?? DEFAULT_STOP_ICON
            : DEFAULT_STOP_ICON;
          const stopPhoto = stop.place?.photos?.[0];
          const isValidStopPhoto = stopPhoto?.startsWith('https://');
          const stopCategoryGradient: [string, string] =
            CATEGORY_GRADIENT[stop.place?.category ?? 'Culture'] ?? ['#0f172a', '#1e293b'];
          const isLast = idx === dayItems.length - 1;

          return (
            <TouchableOpacity
              key={`${stop.placeId}-${idx}`}
              onPress={() => onSelect(linearIndex)}
              activeOpacity={0.85}
              style={[styles.row, isActive && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={stop.place?.name ?? 'Stop'}
            >
              {/* Time-block icon + connector */}
              <View style={styles.timeCol}>
                <View style={[styles.emojiBubble, isActive && styles.emojiBubbleActive]}>
                  <MaterialCommunityIcons
                    name={stopIcon}
                    size={15}
                    color={isActive ? '#FFFFFF' : colors.sunsetOrange}
                  />
                </View>
                {!isLast && <View style={styles.connector} />}
              </View>

              {/* Name + neighborhood */}
              <View style={styles.contentCol}>
                <Text
                  style={[styles.nameText, isActive && styles.nameTextActive]}
                  numberOfLines={1}
                >
                  {stop.place?.name ?? 'Unknown place'}
                </Text>
                {stop.place?.neighborhood && (
                  <Text style={styles.neighborhoodText} numberOfLines={1}>
                    {stop.place.neighborhood}
                  </Text>
                )}
              </View>

              {/* Thumbnail */}
              <View style={styles.thumbContainer}>
                {isValidStopPhoto ? (
                  <Image
                    source={{ uri: stopPhoto }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <LinearGradient colors={stopCategoryGradient} style={styles.thumb} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {dayItems.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('follow.noStopsToday')}</Text>
          </View>
        )}
      </ScrollView>

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

  // --- Featured stop card ---
  featuredCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.bgMain,
  },
  featuredPhoto: {
    height: 140,
    position: 'relative',
    justifyContent: 'flex-end',
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

  // --- Day switcher ---
  daySwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dayTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.deepOcean,
  },
  daySwitcher: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  dayChipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  dayChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },

  // --- Stop navigation list ---
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: spacing.sm,
    borderRadius: borderRadius.md,
  },
  rowActive: {
    backgroundColor: colors.sunsetOrange + '12',
  },
  timeCol: {
    alignItems: 'center',
    width: 36,
  },
  emojiBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBubbleActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderColor,
    marginTop: 2,
    minHeight: 8,
  },
  contentCol: {
    flex: 1,
  },
  nameText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.deepOcean,
    lineHeight: 19,
  },
  nameTextActive: {
    color: colors.sunsetOrange,
  },
  neighborhoodText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  thumbContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
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
