import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, fonts, borderRadius } from '../../lib/theme';
import type { ChatSlots } from '../../lib/types';

type Props = {
  slots: ChatSlots;
};

type Badge = { label: string; value: string };

function buildBadges(slots: ChatSlots): Badge[] {
  const badges: Badge[] = [];
  if (slots.city) badges.push({ label: '📍', value: slots.city });
  if (slots.days) badges.push({ label: '📅', value: `${slots.days}d` });
  if (slots.groupType) badges.push({ label: '👥', value: slots.groupType });
  if (slots.budget) badges.push({ label: '💰', value: slots.budget });
  if (slots.pace) badges.push({ label: '⏱', value: slots.pace });
  if (slots.categories && slots.categories.length > 0)
    badges.push({ label: '✨', value: slots.categories.join(', ') });
  return badges;
}

export function SlotBadges({ slots }: Props) {
  const badges = buildBadges(slots);
  if (badges.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {badges.map((badge, i) => (
        <View key={i} style={styles.badge}>
          <Text style={styles.badgeText}>
            {badge.label} {badge.value}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: colors.electricBlueLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.electricBlue,
  },
});
