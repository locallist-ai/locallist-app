import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ViewStyle,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { StopCard } from './StopCard';
import { colors, fonts, borderRadius, spacing } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

export interface Stop {
  id: string;
  name: string;
  category?: string;
  neighborhood?: string;
  photos?: { url: string }[];
  whyThisPlace?: string;
  duration?: number;
  priceRange?: string;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  timeBlock?: string;
  suggestedArrival?: string;
  travelFromPrevious?: {
    distance_km: number;
    duration_min: number;
    mode: string;
  } | null;
}

interface BottomSheetStopProps {
  stop: Stop;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPause?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  isPaused?: boolean;
  style?: ViewStyle;
}

const SWIPE_THRESHOLD = 60;
const EXPAND_THRESHOLD = 40;
const COLLAPSED_HEIGHT = 360;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.78);

export const BottomSheetStop: React.FC<BottomSheetStopProps> = ({
  stop,
  onSwipeLeft,
  onSwipeRight,
  onPause,
  onSkip,
  onNext,
  isPaused = false,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const sheetHeight = useSharedValue(COLLAPSED_HEIGHT);
  const startHeight = useSharedValue(COLLAPSED_HEIGHT);
  const entrance = useSharedValue(COLLAPSED_HEIGHT);

  useEffect(() => {
    entrance.value = withSpring(0, {
      damping: 14,
      mass: 1,
      stiffness: 130,
      overshootClamping: false,
    });
  }, [stop.id, entrance]);

  const callSwipeLeft = () => { if (onSwipeLeft) onSwipeLeft(); };
  const callSwipeRight = () => { if (onSwipeRight) onSwipeRight(); };

  const horizontalPan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-400, { damping: 15, mass: 1, stiffness: 120 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(callSwipeLeft)();
      } else if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(400, { damping: 15, mass: 1, stiffness: 120 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(callSwipeRight)();
      } else {
        translateX.value = withSpring(0, { damping: 15, mass: 1, stiffness: 120 });
      }
    });

  const verticalPan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    .onStart(() => {
      startHeight.value = sheetHeight.value;
    })
    .onUpdate((event) => {
      const next = startHeight.value - event.translationY;
      sheetHeight.value = Math.max(COLLAPSED_HEIGHT, Math.min(EXPANDED_HEIGHT, next));
    })
    .onEnd(() => {
      const isCurrentlyExpanded = sheetHeight.value > (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;
      sheetHeight.value = withSpring(
        isCurrentlyExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
        { damping: 16, mass: 1, stiffness: 140 },
      );
      runOnJS(Haptics.selectionAsync)();
    });

  const composed = Gesture.Race(horizontalPan, verticalPan);

  const toggleExpanded = () => {
    const expanded = sheetHeight.value > (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;
    sheetHeight.value = withSpring(
      expanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT,
      { damping: 16, mass: 1, stiffness: 140 },
    );
    Haptics.selectionAsync();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    transform: [
      { translateY: entrance.value },
      { translateX: translateX.value },
    ],
  }));

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext?.();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSkip?.();
  };

  const handlePause = () => {
    Haptics.selectionAsync();
    onPause?.();
  };

  return (
    <GestureHandlerRootView style={styles.root} pointerEvents="box-none">
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.container, animatedStyle, style]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleExpanded}
            style={styles.handleBar}
            accessibilityRole="button"
            accessibilityLabel="Toggle sheet expansion"
          >
            <View style={styles.handle} />
          </TouchableOpacity>

          <View style={styles.cardWrap}>
            <StopCard stop={stop} />
          </View>

          <View style={[styles.actionBar, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
            <TouchableOpacity
              style={styles.button}
              onPress={handlePause}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
            >
              <MaterialCommunityIcons
                name={isPaused ? 'play' : 'pause'}
                size={20}
                color={colors.electricBlue}
              />
              <Text style={styles.buttonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSkip}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Skip"
            >
              <MaterialCommunityIcons name="skip-forward" size={20} color={colors.sunsetOrange} />
              <Text style={styles.buttonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleNext}
              style={{ flex: 1.2 }}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <LinearGradient
                colors={[colors.electricBlue, '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonPrimaryGradient}
              >
                <Text style={styles.buttonTextPrimary}>Next</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#FFFFFF"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderColor,
  },
  cardWrap: {
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgMain,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.deepOcean,
  },
  buttonPrimaryGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: borderRadius.md,
  },
  buttonTextPrimary: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
