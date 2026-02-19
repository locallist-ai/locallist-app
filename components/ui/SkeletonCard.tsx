import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface SkeletonCardProps {
  height?: number;
  imageHeight?: number;
  style?: any;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  height = 280,
  imageHeight = 180,
  style,
}) => {
  const shimmerAnim = useSharedValue(0);

  useEffect(() => {
    shimmerAnim.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, [shimmerAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerAnim.value,
      [0, 0.5, 1],
      [0.3, 0.8, 0.3],
      Extrapolate.CLAMP
    );

    return {
      opacity,
    };
  });

  return (
    <View style={[styles.card, style, { height }]}>
      {/* Image skeleton */}
      <Animated.View
        style={[
          {
            height: imageHeight,
            width: '100%',
            backgroundColor: '#E5E7EB',
            marginBottom: 12,
          },
          animatedStyle,
        ]}
      />

      {/* Content skeleton */}
      <View style={styles.content}>
        {/* Title skeleton */}
        <Animated.View
          style={[
            {
              height: 20,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
              marginBottom: 12,
              width: '75%',
            },
            animatedStyle,
          ]}
        />

        {/* Subtitle skeleton */}
        <Animated.View
          style={[
            {
              height: 14,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
              marginBottom: 8,
              width: '60%',
            },
            animatedStyle,
          ]}
        />

        {/* Badge skeleton */}
        <Animated.View
          style={[
            {
              height: 12,
              backgroundColor: '#E5E7EB',
              borderRadius: 4,
              width: '40%',
            },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  content: {
    padding: 12,
  },
});
