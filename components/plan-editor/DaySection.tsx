import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { SwipeableStopCard } from './SwipeableStopCard';
import type { PlanStop } from '../../lib/types';

type Props = {
  dayNumber: number;
  stops: (PlanStop & { id?: string })[];
  onReorder: (from: number, to: number) => void;
  onDeleteStop: (stopIndex: number) => void;
  onMoveStop?: (stopIndex: number) => void;
  onAddPress: () => void;
  onStopPress?: (stopIndex: number) => void;
};

export function DaySection({
  dayNumber,
  stops,
  onReorder,
  onDeleteStop,
  onMoveStop,
  onAddPress,
  onStopPress,
}: Props) {
  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PlanStop & { id?: string }>) => {
    const index = getIndex() ?? 0;
    return (
      <ScaleDecorator activeScale={1.03}>
        <SwipeableStopCard
          stop={item}
          onDelete={() => onDeleteStop(index)}
          onMovePress={onMoveStop ? () => onMoveStop(index) : undefined}
          drag={drag}
          isActive={isActive}
          onPress={onStopPress ? () => onStopPress(index) : undefined}
        />
      </ScaleDecorator>
    );
  };

  return (
    <View style={s.section}>
      {/* Day header */}
      <View style={s.header}>
        <LinearGradient
          colors={[colors.deepOcean, '#1e293b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.badge}
        >
          <Text style={s.badgeText}>Day {dayNumber}</Text>
        </LinearGradient>
        <Text style={s.stopCount}>
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
        </Text>
        <View style={s.headerLine} />
      </View>

      {/* Draggable list */}
      <DraggableFlatList
        data={stops}
        keyExtractor={(item, idx) => item.placeId + '-' + idx}
        renderItem={renderItem}
        onDragBegin={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onDragEnd={({ from, to }) => {
          if (from !== to) onReorder(from, to);
        }}
        scrollEnabled={false}
        containerStyle={s.listContainer}
      />

      {/* Add stop button */}
      <TouchableOpacity
        style={s.addBtn}
        onPress={onAddPress}
        activeOpacity={0.7}
        accessibilityLabel={`Add a stop to day ${dayNumber}`}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.sunsetOrange} />
        <Text style={s.addText}>Add a stop</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  stopCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderColor,
  },
  listContainer: {
    minHeight: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.sunsetOrange + '40',
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: colors.sunsetOrange + '08',
    marginTop: spacing.xs,
  },
  addText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
});
