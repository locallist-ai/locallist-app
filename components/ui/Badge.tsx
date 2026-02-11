import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../../lib/theme';

interface BadgeProps {
  text: string;
  variant?: 'default' | 'blue' | 'orange' | 'green';
}

const variantColors = {
  default: { bg: colors.borderColor, text: colors.textMain },
  blue: { bg: colors.electricBlueLight, text: colors.electricBlue },
  orange: { bg: colors.sunsetOrangeLight, text: colors.sunsetOrange },
  green: { bg: '#d1fae5', text: colors.successEmerald },
};

export function Badge({ text, variant = 'default' }: BadgeProps) {
  const color = variantColors[variant];
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.text, { color: color.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
