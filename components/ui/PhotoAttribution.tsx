import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PhotoAttributionProps {
  /** 'compact' para thumbnails pequeños (<=64px); por defecto para hero/mosaico. */
  variant?: 'default' | 'compact';
}

/**
 * Etiqueta discreta "Google" superpuesta a una foto, exigida por el ToS de la
 * Places API cuando `photoSource === 'google'` (ver PlacePhotoUrls en el
 * backend). v1 = solo el nombre "Google"; el autor por foto
 * (`authorAttributions`) es v1.1 y queda fuera de alcance.
 *
 * "Google" es un nombre de marca y no se traduce; solo la descripción
 * accesible (`accessibilityLabel`) tiene copy localizado.
 */
export const PhotoAttribution: React.FC<PhotoAttributionProps> = ({ variant = 'default' }) => {
  const { t } = useTranslation();

  return (
    <Text
      style={[styles.label, variant === 'compact' && styles.labelCompact]}
      accessibilityLabel={t('place.photoAttributionA11y')}
      testID="photo-attribution-google"
    >
      Google
    </Text>
  );
};

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelCompact: {
    bottom: 2,
    right: 3,
    fontSize: 7,
  },
});
