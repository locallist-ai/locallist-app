import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Category } from './PhotoHero';
import { PhotoAttribution } from './PhotoAttribution';
import { resolvePhotoUrl, isDisplayablePhotoUrl } from '../../lib/helpers/photo-url';

type PhotoSource = 'google' | 'external' | null;

/** A mosaic tile: a plain URL string (no attribution info), or an item that
 * carries the place's `photoSource` so we can attribute Google photos. */
export type PhotoMosaicItem = string | { url: string; photoSource?: PhotoSource };

interface PhotoMosaicProps {
  photos: PhotoMosaicItem[];
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
  Shopping: ['#be185d', '#9d174d'],
};

function normalize(item: PhotoMosaicItem): { url: string; photoSource: PhotoSource } {
  return typeof item === 'string'
    ? { url: item, photoSource: null }
    : { url: item.url, photoSource: item.photoSource ?? null };
}

const Tile: React.FC<{ uri?: string; photoSource?: PhotoSource; gradient: [string, string]; style?: object }> = ({
  uri,
  photoSource = null,
  gradient,
  style,
}) => {
  const [failed, setFailed] = React.useState(false);
  const isValid = isDisplayablePhotoUrl(uri) && !failed;
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
          onError={() => setFailed(true)}
        />
      )}
      {isValid && photoSource === 'google' && <PhotoAttribution variant="compact" />}
    </View>
  );
};

export const PhotoMosaic: React.FC<PhotoMosaicProps> = ({
  photos,
  height = 280,
  fallbackCategory = 'Culture',
}) => {
  const gradient = CATEGORY_GRADIENTS[fallbackCategory] ?? CATEGORY_GRADIENTS.Culture;

  const unique = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { url: string; photoSource: PhotoSource }[] = [];
    for (const item of photos) {
      const { url: rawUrl, photoSource } = normalize(item);
      const url = resolvePhotoUrl(rawUrl);
      if (!isDisplayablePhotoUrl(url) || seen.has(url)) continue;
      seen.add(url);
      result.push({ url, photoSource });
      if (result.length >= 4) break;
    }
    return result;
  }, [photos]);

  const count = unique.length;

  if (count <= 1) {
    return (
      <View style={[styles.container, { height }]}>
        <Tile uri={unique[0]?.url} photoSource={unique[0]?.photoSource} gradient={gradient} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (count === 2) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.row}>
          <Tile uri={unique[0].url} photoSource={unique[0].photoSource} gradient={gradient} style={styles.half} />
          <View style={styles.gap} />
          <Tile uri={unique[1].url} photoSource={unique[1].photoSource} gradient={gradient} style={styles.half} />
        </View>
      </View>
    );
  }

  if (count === 3) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.row}>
          <Tile uri={unique[0].url} photoSource={unique[0].photoSource} gradient={gradient} style={styles.left62} />
          <View style={styles.gap} />
          <View style={styles.right38}>
            <Tile uri={unique[1].url} photoSource={unique[1].photoSource} gradient={gradient} style={styles.halfV} />
            <View style={styles.gapV} />
            <Tile uri={unique[2].url} photoSource={unique[2].photoSource} gradient={gradient} style={styles.halfV} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.col}>
        <View style={styles.row}>
          <Tile uri={unique[0].url} photoSource={unique[0].photoSource} gradient={gradient} style={styles.quad} />
          <View style={styles.gap} />
          <Tile uri={unique[1].url} photoSource={unique[1].photoSource} gradient={gradient} style={styles.quad} />
        </View>
        <View style={styles.gapV} />
        <View style={styles.row}>
          <Tile uri={unique[2].url} photoSource={unique[2].photoSource} gradient={gradient} style={styles.quad} />
          <View style={styles.gap} />
          <Tile uri={unique[3].url} photoSource={unique[3].photoSource} gradient={gradient} style={styles.quad} />
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
