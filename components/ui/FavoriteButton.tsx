import React from 'react';
import { TouchableOpacity, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../lib/theme';
import { useFavorites } from '../../lib/favorites-store';
import type { FavoriteSource } from '../../lib/analytics';

type Props = {
  placeId: string;
  source: FavoriteSource;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Favorite affordance: a heart that fills (sunsetOrange) when the place is
 * favorited and reverts to a white outline otherwise, inside a translucent dark
 * bubble for use on top of a photo hero. The heart is ALWAYS an icon (Ionicons),
 * never an emoji, per the brand contract. Toggling is optimistic and owned by
 * `useFavorites`; a guest tap routes to the signup gate instead.
 */
export function FavoriteButton({ placeId, source, size = 24, style }: Props) {
  const { t } = useTranslation();
  const { ids, toggle } = useFavorites();
  const favorited = ids.has(placeId);

  return (
    <TouchableOpacity
      onPress={() => toggle(placeId, source)}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityState={{ selected: favorited }}
      accessibilityLabel={favorited ? t('favorites.remove') : t('favorites.add')}
      style={style}
    >
      <View style={s.overlayBubble}>
        <Ionicons
          name={favorited ? 'heart' : 'heart-outline'}
          size={size}
          color={favorited ? colors.sunsetOrange : '#FFFFFF'}
        />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  overlayBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
