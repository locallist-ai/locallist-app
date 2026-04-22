import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FloatingEmoji } from './FloatingEmoji';

// ── Types ──

interface StepDecorationsProps {
  step: number;
  screenWidth: number;
  screenHeight: number;
}

interface EmojiConfig {
  emoji: string;
  size: number;
  x: number;
  y: number;
  delay: number;
  dx: number;
  dy: number;
  dur: number;
  rot: number;
}

// ── Emoji configs per step ──

const buildEmojiConfigs = (
  screenWidth: number,
  screenHeight: number,
): Record<number, EmojiConfig[]> => ({
  0: [
    { emoji: '\u{1F334}', size: 28, x: 30, y: screenHeight * 0.15, delay: 400, dx: 18, dy: -12, dur: 3200, rot: 12 },
    { emoji: '✈️', size: 24, x: screenWidth - 70, y: screenHeight * 0.22, delay: 800, dx: -15, dy: 16, dur: 3600, rot: -15 },
    { emoji: '\u{1F30D}', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.6, delay: 600, dx: 20, dy: -10, dur: 4000, rot: 8 },
  ],
  1: [
    { emoji: '☀️', size: 28, x: 30, y: screenHeight * 0.22, delay: 400, dx: 20, dy: -15, dur: 3000, rot: 12 },
    { emoji: '\u{1F338}', size: 22, x: screenWidth - 80, y: screenHeight * 0.55, delay: 800, dx: -15, dy: 18, dur: 3500, rot: -15 },
    { emoji: '✈️', size: 26, x: screenWidth * 0.5, y: screenHeight * 0.15, delay: 600, dx: 25, dy: -10, dur: 4000, rot: 20 },
  ],
  2: [
    { emoji: '\u{1F9D1}', size: 24, x: screenWidth - 60, y: screenHeight * 0.25, delay: 300, dx: -12, dy: 18, dur: 3200, rot: -10 },
    { emoji: '❤️', size: 20, x: 40, y: screenHeight * 0.52, delay: 700, dx: 18, dy: -12, dur: 2800, rot: 15 },
    { emoji: '\u{1F46A}', size: 22, x: screenWidth * 0.6, y: screenHeight * 0.12, delay: 500, dx: -20, dy: 14, dur: 3600, rot: -8 },
  ],
  3: [
    { emoji: '\u{1F9ED}', size: 26, x: 20, y: screenHeight * 0.18, delay: 300, dx: 15, dy: -20, dur: 3400, rot: 25 },
    { emoji: '\u{1F33F}', size: 22, x: screenWidth - 50, y: screenHeight * 0.42, delay: 600, dx: -18, dy: 12, dur: 3000, rot: -18 },
    { emoji: '\u{1F3A8}', size: 24, x: 50, y: screenHeight * 0.58, delay: 900, dx: 22, dy: -8, dur: 3800, rot: 12 },
  ],
  4: [
    { emoji: '\u{1F4B0}', size: 22, x: screenWidth - 70, y: screenHeight * 0.2, delay: 200, dx: -10, dy: 22, dur: 2600, rot: -20 },
    { emoji: '\u{1F48E}', size: 20, x: 35, y: screenHeight * 0.35, delay: 600, dx: 16, dy: -14, dur: 3200, rot: 15 },
    { emoji: '\u{1F451}', size: 24, x: screenWidth * 0.5 - 10, y: screenHeight * 0.55, delay: 400, dx: -14, dy: 16, dur: 3600, rot: -12 },
  ],
  5: [
    { emoji: '\u{1F680}', size: 26, x: screenWidth - 60, y: screenHeight * 0.18, delay: 400, dx: -15, dy: -18, dur: 3000, rot: 20 },
    { emoji: '✨', size: 22, x: 30, y: screenHeight * 0.48, delay: 600, dx: 18, dy: 12, dur: 3400, rot: -15 },
    { emoji: '\u{1F30D}', size: 24, x: screenWidth * 0.4, y: screenHeight * 0.6, delay: 800, dx: -12, dy: -16, dur: 3800, rot: 10 },
  ],
});

// ── Component ──

export const StepDecorations: React.FC<StepDecorationsProps> = ({ step, screenWidth, screenHeight }) => {
  const emojis = buildEmojiConfigs(screenWidth, screenHeight)[step] ?? [];

  return (
    <View style={styles.overlay} pointerEvents="none">
      {emojis.map((e, i) => (
        <FloatingEmoji
          key={`${step}-${i}`}
          emoji={e.emoji}
          size={e.size}
          startX={e.x}
          startY={e.y}
          delay={e.delay}
          driftX={e.dx}
          driftY={e.dy}
          duration={e.dur}
          rotateDeg={e.rot}
        />
      ))}
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
