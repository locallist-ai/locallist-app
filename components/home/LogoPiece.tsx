import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

// ── Types ──

interface LogoPieceProps {
  posStyle: Partial<Pick<ViewStyle, 'top' | 'bottom' | 'left' | 'right'>>;
  animStyle: AnimatedStyle<ViewStyle>;
}

// ── Component ──

export const LogoPiece: React.FC<LogoPieceProps> = React.memo(({ posStyle, animStyle }) => {
  return (
    <Animated.View style={[styles.wrapper, posStyle, animStyle]}>
      <View style={styles.circle}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
});

// ── Styles ──

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 44,
    height: 44,
  },
});
