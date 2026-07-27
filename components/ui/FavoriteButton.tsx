import React from 'react';
import { TouchableOpacity, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
 * Favorite affordance over a photo hero, in the branded bubble language (same
 * contract as the wizard ChoiceChip icon bubbles): a paperWhite bubble with a
 * subtle sunsetOrange border and a `MaterialCommunityIcons` heart glyph.
 * Unfavorited = paperWhite bubble + `heart-outline` in sunsetOrange; favorited =
 * sunsetOrange bubble + filled `heart` in white. The heart is ALWAYS an icon,
 * never an emoji, per the brand contract. The paperWhite bubble keeps the glyph
 * legible on top of any photo. Toggling is optimistic and owned by
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
      <View style={[s.overlayBubble, favorited && s.overlayBubbleSelected]}>
        <MaterialCommunityIcons
          name={favorited ? 'heart' : 'heart-outline'}
          size={size}
          color={favorited ? '#FFFFFF' : colors.sunsetOrange}
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
    backgroundColor: 'rgba(242, 239, 233, 0.85)', // paperWhite tinted
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBubbleSelected: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
});
