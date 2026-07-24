import React from 'react';
import { View, Text, StyleSheet, ImageSourcePropType, Image as RNImage } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolvePhotoUrl, isPhotoDisplayable } from '../../lib/helpers/photo-url';
import { PhotoAttribution } from './PhotoAttribution';

export type Category = 'Food' | 'Outdoors' | 'Coffee' | 'Nightlife' | 'Culture' | 'Wellness' | 'Shopping';

// Sentinel for the failed-URL state when the shown image is a local require()
// asset (no URL to key by). Cannot collide with any http(s) URL.
const LOCAL_IMAGE_KEY = '__local__';

interface PhotoHeroProps {
  imageUrl?: string;
  /** Local asset via require() — takes priority over imageUrl */
  localImage?: ImageSourcePropType;
  /**
   * Google Places ToS requires attribution on photos served by our Google
   * photo proxy. `'google'` renders a discrete "Google" overlay; `'external'`
   * / `null` / omitted renders none.
   */
  photoSource?: 'google' | 'external' | null;
  fallbackCategory?: Category;
  title?: string;
  subtitle?: string;
  height?: number;
  /** When true, adds safe area inset padding at top (for full-screen heroes) */
  withSafeArea?: boolean;
  /** When true, shows the full photo with a blurred version as backdrop (no cropping). */
  blurBackdrop?: boolean;
  onImageLoadError?: () => void;
}

const CATEGORY_GRADIENTS: Record<Category, [string, string]> = {
  Food: ['#f97316', '#ea580c'],           // sunsetOrange
  Outdoors: ['#10b981', '#059669'],       // successEmerald
  Coffee: ['#92400e', '#78350f'],         // brown
  Nightlife: ['#1e1b4b', '#312e81'],      // deep indigo
  Culture: ['#0f172a', '#1e293b'],        // deepOcean
  Wellness: ['#7c3aed', '#6d28d9'],       // purple
  Shopping: ['#be185d', '#9d174d'],       // rose-700 → rose-800
};

export const PhotoHero: React.FC<PhotoHeroProps> = ({
  imageUrl,
  localImage,
  photoSource = null,
  fallbackCategory = 'Culture',
  title,
  subtitle,
  height = 250,
  withSafeArea = false,
  blurBackdrop = false,
  onImageLoadError,
}) => {
  const insets = useSafeAreaInsets();
  // Keyed by URL (not a boolean): a paginated carousel keeps this hero mounted
  // while imageUrl changes, so a prior failure must not suppress the new photo.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);

  // Local asset takes priority, then a resolved (relative or absolute) URL.
  const resolvedUrl = resolvePhotoUrl(imageUrl);
  const failedLocal = localImage != null && failedUrl === LOCAL_IMAGE_KEY;
  const shouldShowImage = localImage != null
    ? !failedLocal
    : isPhotoDisplayable(resolvedUrl, failedUrl);
  const imageSource = localImage || { uri: resolvedUrl ?? undefined };

  const gradientColors = CATEGORY_GRADIENTS[fallbackCategory] ?? CATEGORY_GRADIENTS.Culture;
  const [overlayColor1, overlayColor2] = gradientColors;

  return (
    <View style={[styles.container, { height, paddingTop: withSafeArea ? insets.top : 0 }]}>
      {/* Always show category gradient as base (instant color, never grey) */}
      <LinearGradient
        colors={[overlayColor1, overlayColor2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.image}
      />

      {/* Blur backdrop — same photo, cover+blurred, fills container edges
       *  so the sharp image on top can use contentFit="contain" without
       *  showing empty bars. */}
      {shouldShowImage && blurBackdrop && (
        <RNImage
          source={imageSource as any}
          style={styles.image}
          resizeMode="cover"
          blurRadius={25}
        />
      )}

      {/* Image loads on top with fade-in transition */}
      {shouldShowImage && (
        <Image
          source={imageSource}
          style={styles.image}
          contentFit={blurBackdrop ? 'contain' : 'cover'}
          transition={200}
          cachePolicy="memory-disk"
          onError={() => {
            setFailedUrl(localImage != null ? LOCAL_IMAGE_KEY : resolvedUrl);
            onImageLoadError?.();
          }}
        />
      )}

      {/* "Google" attribution, required by the Places API photo ToS */}
      {shouldShowImage && !localImage && photoSource === 'google' && <PhotoAttribution />}

      {/* Dark overlay for text readability (only when text is shown) */}
      {shouldShowImage && (title || subtitle) && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.overlay}
        />
      )}

      {(title || subtitle) && (
        <View style={styles.textContainer}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#F2EFE9',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  textContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
