import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import type { PlanStop } from '../../lib/types';

type Category = 'Food' | 'Outdoors' | 'Coffee' | 'Nightlife' | 'Culture' | 'Wellness';

const CATEGORY_GRADIENTS: Record<Category, [string, string]> = {
  Food: ['#f97316', '#ea580c'],
  Outdoors: ['#10b981', '#059669'],
  Coffee: ['#92400e', '#78350f'],
  Nightlife: ['#1e1b4b', '#312e81'],
  Culture: ['#0f172a', '#1e293b'],
  Wellness: ['#7c3aed', '#6d28d9'],
};

type Props = {
  stop: PlanStop & { id?: string };
  onMovePress?: () => void;
  drag: () => void;
  isActive: boolean;
  onPress?: () => void;
};

export function EditableStopCard({ stop, onMovePress, drag, isActive, onPress }: Props) {
  const place = stop.place;
  const photoUrl = place?.photos?.[0] ?? null;
  const category = (place?.category ?? 'Culture') as Category;
  const gradient = CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Culture;

  return (
    <View style={[s.card, isActive && s.cardActive]}>
      {/* Drag handle */}
      <TouchableOpacity
        onLongPress={drag}
        delayLongPress={150}
        style={s.dragHandle}
        accessibilityLabel="Drag to reorder"
        accessibilityRole="button"
      >
        <Ionicons name="reorder-three" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Tappable area: photo + content → navigates to stop slide */}
      <TouchableOpacity
        style={s.tappable}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        accessibilityRole={onPress ? 'button' : 'none'}
        accessibilityLabel={onPress ? `View ${place?.name ?? 'stop'} details` : undefined}
      >
        <View style={s.thumbnail}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={s.thumbnailImg} contentFit="cover" />
          ) : (
            <LinearGradient colors={gradient} style={s.thumbnailImg} />
          )}
        </View>

        <View style={s.content}>
          <Text style={s.name} numberOfLines={1}>
            {place?.name ?? 'Unknown place'}
          </Text>
          <View style={s.metaRow}>
            {place?.category && (
              <View style={s.categoryChip}>
                <Text style={s.categoryText}>{place.category}</Text>
              </View>
            )}
            {stop.suggestedDurationMin != null && (
              <View style={s.durationChip}>
                <Ionicons name="time-outline" size={11} color={colors.electricBlue} />
                <Text style={s.durationText}>~{stop.suggestedDurationMin}m</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Move to day button — only shown for multi-day plans */}
      {onMovePress && (
        <TouchableOpacity
          onPress={onMovePress}
          style={s.moveBtn}
          accessibilityLabel="Move to another day"
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  cardActive: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    transform: [{ scale: 1.03 }],
  },
  dragHandle: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgMain,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  tappable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepOcean,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: colors.sunsetOrange + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.sunsetOrange,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.electricBlue + '10',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  durationText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.electricBlue,
  },
  moveBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
