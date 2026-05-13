import type { MaterialCommunityIcons } from '@expo/vector-icons';

export interface City {
  name: string;
  emoji: string;
  color: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const CITIES: City[] = [
  { name: 'Miami', emoji: '\u{1F334}', color: '#f97316', iconName: 'palm-tree' },
];
