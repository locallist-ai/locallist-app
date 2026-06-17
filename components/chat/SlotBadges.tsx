import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fonts, borderRadius } from '../../lib/theme';
import type { ChatSlots } from '../../lib/types';

type Props = {
  slots: ChatSlots;
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Badge = { icon: IconName; value: string };

const badgeColor = 'rgba(255,255,255,0.9)';

function buildBadges(slots: ChatSlots): Badge[] {
  const badges: Badge[] = [];
  if (slots.city) badges.push({ icon: 'map-marker-outline', value: slots.city });
  if (slots.days) badges.push({ icon: 'calendar-blank-outline', value: `${slots.days}d` });
  if (slots.groupType) badges.push({ icon: 'account-group-outline', value: slots.groupType });
  if (slots.budget) badges.push({ icon: 'wallet-outline', value: slots.budget });
  if (slots.pace) badges.push({ icon: 'speedometer', value: slots.pace });
  if (slots.categories && slots.categories.length > 0)
    badges.push({ icon: 'star-four-points-outline', value: slots.categories.join(', ') });
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
          <MaterialCommunityIcons name={badge.icon} size={13} color={badgeColor} />
          <Text style={styles.badgeText}>{badge.value}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: badgeColor,
  },
});
