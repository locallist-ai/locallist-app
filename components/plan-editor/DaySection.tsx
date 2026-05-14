import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { SwipeableStopCard } from './SwipeableStopCard';
import type { PlanStop } from '../../lib/types';

type Props = {
  dayNumber: number;
  stops: (PlanStop & { id?: string })[];
  onReorder: (from: number, to: number) => void;
  onDeleteStop: (stopIndex: number) => void;
  onMoveStop?: (stopIndex: number) => void;
  onReplaceStop?: (stopIndex: number) => void;
  onAddPress: () => void;
  onStopPress?: (stopIndex: number) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function DaySection({
  dayNumber,
  stops,
  onReorder,
  onDeleteStop,
  onMoveStop,
  onReplaceStop,
  onAddPress,
  onStopPress,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  style,
  contentContainerStyle,
}: Props) {
  const { t } = useTranslation();

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PlanStop & { id?: string }>) => {
    const index = getIndex() ?? 0;
    return (
      <View style={s.row}>
        <ScaleDecorator activeScale={1.03}>
          <SwipeableStopCard
            stop={item}
            onDelete={() => onDeleteStop(index)}
            onMovePress={onMoveStop ? () => onMoveStop(index) : undefined}
            onReplacePress={onReplaceStop ? () => onReplaceStop(index) : undefined}
            drag={drag}
            isActive={isActive}
            onPress={onStopPress ? () => onStopPress(index) : undefined}
          />
        </ScaleDecorator>
      </View>
    );
  };

  const listFooter = (
    <View style={s.footerWrap}>
      <TouchableOpacity
        style={s.addBtn}
        onPress={onAddPress}
        activeOpacity={0.7}
        accessibilityLabel={`Add a stop to day ${dayNumber}`}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.sunsetOrange} />
        <Text style={s.addText}>{t('plan.addStop')}</Text>
      </TouchableOpacity>
      {ListFooterComponent}
    </View>
  );

  return (
    <DraggableFlatList
      data={stops}
      keyExtractor={(item) => item.id ?? item.placeId}
      renderItem={renderItem}
      onDragBegin={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      onDragEnd={({ from, to }) => {
        if (from !== to) onReorder(from, to);
      }}
      animationConfig={{
        damping: 30,
        stiffness: 350,
        mass: 0.15,
        overshootClamping: true,
      }}
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={listFooter}
    />
  );
}

const s = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
  },
  footerWrap: {
    paddingHorizontal: spacing.lg,
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
    marginBottom: spacing.sm,
  },
  addText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
});
