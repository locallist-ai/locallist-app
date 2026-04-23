import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts, borderRadius } from '../../lib/theme';

const CATEGORY_COLOR: Record<string, string> = {
  Food: '#f97316',
  Outdoors: '#10b981',
  Coffee: '#92400e',
  Nightlife: '#1e1b4b',
  Culture: '#0f172a',
  Wellness: '#7c3aed',
};

export type CategoryBadgeSize = 'sm' | 'md';

interface CategoryBadgeProps {
  category?: string;
  size?: CategoryBadgeSize;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, size = 'md' }) => {
  if (!category) return null;
  const color = CATEGORY_COLOR[category] ?? '#0f172a';
  const s = size === 'sm' ? styles.sm : styles.md;
  const t = size === 'sm' ? styles.textSm : styles.textMd;
  return (
    <View style={[styles.base, s, { backgroundColor: color }]}>
      <Text style={[styles.text, t]}>{category}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 11,
  },
});
