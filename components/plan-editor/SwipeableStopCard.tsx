import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { EditableStopCard } from './EditableStopCard';
import type { PlanStop } from '../../lib/types';

type Props = {
  stop: PlanStop & { id?: string };
  onDelete: () => void;
  onMovePress: () => void;
  drag: () => void;
  isActive: boolean;
};

export function SwipeableStopCard({ stop, onDelete, onMovePress, drag, isActive }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <RectButton
        style={s.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete();
        }}
      >
        <RNAnimated.View style={[s.deleteContent, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          <Text style={s.deleteText}>Delete</Text>
        </RNAnimated.View>
      </RectButton>
    );
  };

  return (
    <View style={s.container}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={2}
        overshootRight={false}
        enabled={!isActive}
      >
        <EditableStopCard
          stop={stop}
          onMovePress={onMovePress}
          drag={drag}
          isActive={isActive}
        />
      </Swipeable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  deleteAction: {
    width: 80,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
  },
  deleteContent: {
    alignItems: 'center',
    gap: 4,
  },
  deleteText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
});
