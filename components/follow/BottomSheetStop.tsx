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
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StopCard } from './StopCard';

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
        runOnJS(onSwipeLeft)?.();
      }
      // Swipe right (previous)
      else if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(400, { damping: 10 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(onSwipeRight)?.();
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
                color="#3b82f6"
              />
              <Text style={styles.buttonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="skip-forward" size={20} color="#f97316" />
              <Text style={styles.buttonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonTextPrimary}>Next</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#FFFFFF"
              />
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F2EFE9',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  buttonPrimary: {
    backgroundColor: '#3b82f6',
    flex: 1.2,
  },
  buttonTextPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
