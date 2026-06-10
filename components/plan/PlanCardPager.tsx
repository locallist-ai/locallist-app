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
import { Ionicons } from '@expo/vector-icons';
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
import { useTranslation } from 'react-i18next';
import { ProgressDots } from '../ui/design-system';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { usePlanEditorContext } from './PlanEditorContext';
import { PlanEditorModalsHost } from './PlanEditorModals';
import { PlanOverview } from './PlanOverview';
import { DayStopsCarousel } from './DayStopsCarousel';
import type { Plan, PlanStop } from '../../lib/types';

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
  totalDays,
  safeAreaTop = 0,
}) => {
  const { t } = useTranslation();
  const { days: editorDays } = usePlanEditorContext();
  const [slide, setSlide] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const lastHaptic = useRef(0);
  const hintPulse = useSharedValue(0);

  const allDays = useMemo(() => {
    const set = new Set<number>();
    stops.forEach((s) => set.add(s.dayNumber || 1));
    editorDays.forEach((d) => set.add(d.dayNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [stops, editorDays]);
  const [currentDay, setCurrentDay] = useState<number>(allDays[0] ?? 1);
  useEffect(() => {
    if (allDays.length > 0 && !allDays.includes(currentDay)) {
      setCurrentDay(allDays[0]);
    }
  }, [allDays, currentDay]);

  const stopsForDay = useMemo(
    () => stops.filter((s) => (s.dayNumber || 1) === currentDay).sort((a, b) => a.orderIndex - b.orderIndex),
    [stops, currentDay],
  );

  const slotCount = 1 + stopsForDay.length;
  const hasMoreSlides = slotCount > 1;

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
    const stop = stopsForDay[slide - 1];
    if (!stop) return '';
    return `Stop ${slide} of ${stopsForDay.length}`;
  }, [slide, stopsForDay]);

  const handleDayChange = (day: number) => {
    Haptics.selectionAsync();
    if (day !== currentDay) {
      setCurrentDay(day);
      setSlide(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
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
      <PlanEditorModalsHost city={plan.city} totalDays={effectiveTotalDays}>
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
          <PlanOverview
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
            onScrollToStop={handleScrollToStop}
            currentDay={currentDay}
            allDays={allDays}
            onDayChange={handleDayChange}
          />
          <DayStopsCarousel stops={stopsForDay} dayNumber={currentDay} isOwner={isOwner} />
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
            accessibilityLabel={slide > 0 ? t('plan.backToOverview') : t('plan.goBack')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.deepOcean} />
          </TouchableOpacity>
        )}
      </PlanEditorModalsHost>
    </View>
  );
};

/* ───── Styles ───── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  scroll: {
    flex: 1,
  },

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
