import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Category } from './PhotoHero';

interface PhotoMosaicProps {
  photos: string[];
  height?: number;
  fallbackCategory?: Category;
}

const CATEGORY_GRADIENTS: Record<Category, [string, string]> = {
  Food: ['#f97316', '#ea580c'],
  Outdoors: ['#10b981', '#059669'],
  Coffee: ['#92400e', '#78350f'],
  Nightlife: ['#1e1b4b', '#312e81'],
  Culture: ['#0f172a', '#1e293b'],
  Wellness: ['#7c3aed', '#6d28d9'],
};

const Tile: React.FC<{ uri?: string; gradient: [string, string]; style?: object }> = ({ uri, gradient, style }) => {
  const isValid = uri && uri.startsWith('https://');
  return (
    <View style={[styles.tile, style]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isValid && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      )}
    </View>
  );
};

export const PhotoMosaic: React.FC<PhotoMosaicProps> = ({
  photos,
  height = 280,
  fallbackCategory = 'Culture',
}) => {
  const gradient = CATEGORY_GRADIENTS[fallbackCategory] ?? CATEGORY_GRADIENTS.Culture;
  const unique = Array.from(new Set(photos.filter((p) => p && p.startsWith('https://')))).slice(0, 4);
  const count = unique.length;

  if (count <= 1) {
    return (
      <View style={[styles.container, { height }]}>
        <Tile uri={unique[0]} gradient={gradient} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.row}>
          <Tile uri={unique[0]} gradient={gradient} style={styles.half} />
          <View style={styles.gap} />
          <Tile uri={unique[1]} gradient={gradient} style={styles.half} />
        </View>
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.row}>
          <Tile uri={unique[0]} gradient={gradient} style={styles.left62} />
          <View style={styles.gap} />
          <View style={styles.right38}>
            <Tile uri={unique[1]} gradient={gradient} style={styles.halfV} />
            <View style={styles.gapV} />
            <Tile uri={unique[2]} gradient={gradient} style={styles.halfV} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.col}>
        <View style={styles.row}>
          <Tile uri={unique[0]} gradient={gradient} style={styles.quad} />
          <View style={styles.gap} />
          <Tile uri={unique[1]} gradient={gradient} style={styles.quad} />
        </View>
        <View style={styles.gapV} />
        <View style={styles.row}>
          <Tile uri={unique[2]} gradient={gradient} style={styles.quad} />
          <View style={styles.gap} />
          <Tile uri={unique[3]} gradient={gradient} style={styles.quad} />
        </View>
      </View>
    </View>
  );
};

const GAP = 2;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#F2EFE9',
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    flexDirection: 'column',
  },
  tile: {
    overflow: 'hidden',
  },
  half: {
    flex: 1,
  },
  halfV: {
    flex: 1,
  },
  gap: {
    width: GAP,
  },
  gapV: {
    height: GAP,
  },
  left62: {
    flex: 62,
  },
  right38: {
    flex: 38,
    flexDirection: 'column',
  },
  quad: {
    flex: 1,
  },
});
