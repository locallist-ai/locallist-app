import type { MaterialCommunityIcons } from '@expo/vector-icons';

export const TIME_BLOCK_EMOJI: Record<string, string> = {
  morning: '☀️',
  lunch: '🍽️',
  afternoon: '⛲',
  dinner: '🍷',
  evening: '🌙',
};

export const DEFAULT_STOP_EMOJI = '📍';

type MciGlyph = keyof typeof MaterialCommunityIcons.glyphMap;

// Branded MCI glyphs por time-block. Sustituye al emoji legacy en bubbles
// (paperWhite + sunsetOrange) en StopCard, FollowDaySheet, PlanCardPager.
export const TIME_BLOCK_ICON: Record<string, MciGlyph> = {
  morning: 'weather-sunny',
  lunch: 'silverware-fork-knife',
  afternoon: 'coffee-outline',
  dinner: 'glass-wine',
  evening: 'weather-night',
};

export const DEFAULT_STOP_ICON: MciGlyph = 'map-marker-outline';
