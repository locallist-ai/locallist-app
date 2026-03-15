import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';
import type { City } from './constants';

// ── Types ──

interface CityCardProps {
  city: City;
  index: number;
  onSelect: (name: string) => void;
}

// ── Component ──

export const CityCard: React.FC<CityCardProps> = React.memo(({ city, index, onSelect }) => {
  const pulse = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    const delay = 600 + index * 200;
    const timer = setTimeout(() => {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.97, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(249, 115, 22, ${glowOpacity.value})`,
  }));

  return (
    <Animated.View entering={FadeInUp.duration(700).delay(200 + index * 150).springify().damping(12)}>
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSelect(city.name)}
          style={styles.touchable}
          accessibilityLabel={city.name}
          accessibilityRole="button"
        >
          <Animated.View style={[styles.card, borderStyle]}>
            <BlurView intensity={60} tint="light" style={styles.blur}>
              <View style={styles.row}>
                <View style={styles.nameRow}>
                  <Text style={styles.emoji}>{city.emoji}</Text>
                  <Text style={styles.name}>{city.name}</Text>
                </View>
                <View style={styles.arrowCircle}>
                  <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                </View>
              </View>
            </BlurView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

// ── Styles ──

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  blur: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emoji: {
    fontSize: 36,
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: colors.deepOcean,
  },
  arrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 7,
    elevation: 6,
  },
});
