import React from 'react';
import { View, Text, StyleSheet, ImageSourcePropType } from 'react-native';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Category = 'Food' | 'Outdoors' | 'Coffee' | 'Nightlife' | 'Culture' | 'Wellness';

interface PhotoHeroProps {
  imageUrl?: string;
  /** Local asset via require() — takes priority over imageUrl */
  localImage?: ImageSourcePropType;
  fallbackCategory?: Category;
  title?: string;
  subtitle?: string;
  height?: number;
  /** When true, adds safe area inset padding at top (for full-screen heroes) */
  withSafeArea?: boolean;
  onImageLoadError?: () => void;
}

const CATEGORY_GRADIENTS: Record<Category, [string, string]> = {
  Food: ['#f97316', '#ea580c'],           // sunsetOrange
  Outdoors: ['#10b981', '#059669'],       // successEmerald
  Coffee: ['#92400e', '#78350f'],         // brown
  Nightlife: ['#1e1b4b', '#312e81'],      // deep indigo
  Culture: ['#0f172a', '#1e293b'],        // deepOcean
  Wellness: ['#7c3aed', '#6d28d9'],       // purple
};

export const PhotoHero: React.FC<PhotoHeroProps> = ({
  imageUrl,
  localImage,
  fallbackCategory = 'Culture',
  title,
  subtitle,
  height = 250,
  withSafeArea = false,
  onImageLoadError,
}) => {
  const insets = useSafeAreaInsets();
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);

  // Local asset takes priority, then HTTPS URL
  const isValidUrl = imageUrl && imageUrl.startsWith('https://');
  const shouldShowImage = (localImage || isValidUrl) && !imageLoadFailed;
  const imageSource = localImage || { uri: imageUrl };

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

      {/* Image loads on top with fade-in transition */}
      {shouldShowImage && (
        <Image
          source={imageSource}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => {
            setImageLoadFailed(true);
            onImageLoadError?.();
          }}
        />
      )}

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
