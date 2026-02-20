import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useAnimatedGestureHandler,
  runOnJS,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { StopCard } from './StopCard';
import { colors, fonts, borderRadius, spacing } from '../../lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface Stop {
  id: string;
  name: string;
  category?: string;
  neighborhood?: string;
  photos?: { url: string }[];
  whyThisPlace?: string;
  duration?: number;
  priceRange?: string;
}

interface Plan {
  category?: string;
}

interface BottomSheetStopProps {
  stop: Stop;
  plan?: Plan;
  index?: number;
  totalStops?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPause?: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  isPaused?: boolean;
  style?: ViewStyle;
}

const SWIPE_THRESHOLD = 50;
const SHEET_HEIGHT = 300;

export const BottomSheetStop: React.FC<BottomSheetStopProps> = ({
  stop,
  plan,
  index = 0,
  totalStops = 1,
  onSwipeLeft,
  onSwipeRight,
  onPause,
  onSkip,
  onNext,
  isPaused = false,
  style,
}) => {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const translateX = useSharedValue(0);

  // Spring animation on mount
  useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 12,
      mass: 1,
      overshootClamping: false,
    });
  }, [stop.id, translateY]);

  // Gesture handler for swipes
  const callSwipeLeft = () => { if (onSwipeLeft) onSwipeLeft(); };
  const callSwipeRight = () => { if (onSwipeRight) onSwipeRight(); };

  // Gesture handler for swipes
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx: any) => {
      translateX.value = ctx.startX + event.translationX;
    },
    onEnd: (event) => {
      // Swipe left (next)
      if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-400, { damping: 10 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(callSwipeLeft)();
      }
      // Swipe right (previous)
      else if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(400, { damping: 10 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(callSwipeRight)();
      }
      // No swipe, reset
      else {
        translateX.value = withSpring(0, { damping: 12 });
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
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
    <GestureHandlerRootView style={styles.root}>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.container, animatedStyle, style]}>
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={styles.handle} />
          </View>

          {/* Stop card content */}
          <StopCard stop={stop} plan={plan} index={index} totalStops={totalStops} />

          {/* Bottom action bar */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.button}
              onPress={handlePause}
              activeOpacity={0.7}
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
            >
              <MaterialCommunityIcons name="skip-forward" size={20} color={colors.sunsetOrange} />
              <Text style={styles.buttonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleNext}
              style={{ flex: 1.2 }}
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
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgMain,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderColor,
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
