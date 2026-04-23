import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';
import { TIME_BLOCK_EMOJI, DEFAULT_STOP_EMOJI } from '../../lib/timeBlocks';

// Carousel horizontal de próximos stops tras el actual. Aparece entre la top
// bar y el bottom sheet en Follow Mode para que el usuario mantenga visibilidad
// del itinerario del día (patrón Citymapper/Wanderlog) sin tener que expandir
// el sheet. Tap en un item salta a ese stop.

export interface PreviewStop {
  id: string;
  name: string;
  timeBlock?: string;
  suggestedArrival?: string;
  photoUrl?: string;
  category?: string;
}

interface NextStopsCarouselProps {
  stops: PreviewStop[];
  currentIndex: number;
  onSelect: (absoluteIndex: number) => void;
}

export const NextStopsCarousel: React.FC<NextStopsCarouselProps> = ({
  stops,
  currentIndex,
  onSelect,
}) => {
  // Mostramos hasta 3 stops siguientes al actual (y el actual marcado como destacado).
  const windowStart = currentIndex;
  const windowEnd = Math.min(stops.length, currentIndex + 4);
  const visible = stops.slice(windowStart, windowEnd);

  if (visible.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.container}
    >
      {visible.map((stop, i) => {
        const absoluteIndex = windowStart + i;
        const isCurrent = absoluteIndex === currentIndex;
        const emoji = stop.timeBlock ? TIME_BLOCK_EMOJI[stop.timeBlock] ?? DEFAULT_STOP_EMOJI : DEFAULT_STOP_EMOJI;
        return (
          <TouchableOpacity
            key={stop.id}
            activeOpacity={0.8}
            onPress={() => onSelect(absoluteIndex)}
            style={[styles.card, isCurrent && styles.cardCurrent]}
            accessibilityRole="button"
            accessibilityLabel={`Stop ${absoluteIndex + 1}: ${stop.name}`}
            accessibilityState={{ selected: isCurrent }}
          >
            <View style={[styles.avatar, isCurrent && styles.avatarCurrent]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <Text style={[styles.name, isCurrent && styles.nameCurrent]} numberOfLines={1}>
              {stop.name}
            </Text>
            {stop.suggestedArrival && (
              <Text style={styles.time}>
                <Ionicons name="time-outline" size={10} color={isCurrent ? colors.sunsetOrange : colors.textSecondary} />
                {' '}
                {stop.suggestedArrival}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 92,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  card: {
    width: 96,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.50)',
  },
  cardCurrent: {
    backgroundColor: colors.sunsetOrangeLight,
    borderColor: colors.sunsetOrange,
    shadowColor: colors.sunsetOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCurrent: {
    backgroundColor: colors.sunsetOrange + '25',
  },
  emoji: {
    fontSize: 16,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.deepOcean,
    textAlign: 'center',
  },
  nameCurrent: {
    color: colors.deepOcean,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
