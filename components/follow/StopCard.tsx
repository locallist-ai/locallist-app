import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import { FavoriteButton } from '../ui/FavoriteButton';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { formatPriceLabel } from '../../lib/helpers/price';
import { formatTime12h } from '../../lib/helpers/time';
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
import type { PlanStop } from '../../lib/types';

interface StopCardProps {
  stop: PlanStop;
}

const CATEGORY_COLOR: Record<string, string> = {
  Food: '#f97316',
  Outdoors: '#10b981',
  Coffee: '#92400e',
  Nightlife: '#1e1b4b',
  Culture: '#0f172a',
  Wellness: '#7c3aed',
};

const formatDuration = (minutes?: number): string => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
};

export const StopCard: React.FC<StopCardProps> = ({ stop }) => {
  const { t } = useTranslation();
  // Same shape the backend actually sends (PlanStop.place = PlaceDto): the
  // photo array and its `photoSource` live at place level — matching
  // FollowDaySheet — not a per-photo `{ url, photoSource }` object.
  const place = stop.place;
  const photoUrl = place?.photos?.[0];
  const photoSource = place?.photoSource ?? null;
  const categoryColor = CATEGORY_COLOR[place?.category ?? 'Culture'] ?? '#0f172a';

  const timeIcon = stop.timeBlock ? TIME_BLOCK_ICON[stop.timeBlock] ?? DEFAULT_STOP_ICON : null;
  const travel = stop.travelFromPrevious;
  const why = place?.whyThisPlace ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      scrollEnabled
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View>
        <PhotoHero
          imageUrl={photoUrl}
          photoSource={photoSource}
          fallbackCategory={(place?.category as Category) || 'Culture'}
          height={180}
          blurBackdrop
        />
        {/* Favorite heart — canonical place card (Follow Mode + plan detail). */}
        {place?.id && (
          <FavoriteButton placeId={place.id} source="card" style={styles.favoriteBtn} />
        )}
      </View>

      <View style={styles.content}>
        {(timeIcon || stop.suggestedArrival) && (
          <View style={styles.topMetaRow}>
            {timeIcon && (
              <View style={styles.timePill}>
                <View style={styles.timeIconBubble}>
                  <MaterialCommunityIcons name={timeIcon} size={12} color={colors.sunsetOrange} />
                </View>
                {stop.suggestedArrival && (
                  <Text style={styles.timePillText}>{formatTime12h(stop.suggestedArrival)}</Text>
                )}
              </View>
            )}
            {travel && travel.duration_min > 0 && (
              <View style={styles.travelPill}>
                <MaterialCommunityIcons
                  name={travel.mode === 'walk' ? 'walk' : 'car'}
                  size={13}
                  color="#0369a1"
                />
                <Text style={styles.travelPillText}>
                  {t('stop.travelFromPrev', { min: Math.round(travel.duration_min) })}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.name}>{place?.name}</Text>

        <View style={styles.metaRow}>
          {place?.category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
              <Text style={styles.categoryText}>{place.category}</Text>
            </View>
          )}
          {place?.neighborhood && (
            <View style={styles.neighborhoodRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.neighborhood}>{place.neighborhood}</Text>
            </View>
          )}
        </View>

        {(stop.suggestedDurationMin || place?.priceRange || place?.googleRating) && (
          <View style={styles.infoRow}>
            {stop.suggestedDurationMin != null && stop.suggestedDurationMin > 0 && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.deepOcean} />
                <Text style={styles.infoPillText}>{formatDuration(stop.suggestedDurationMin)}</Text>
              </View>
            )}
            {place?.priceRange && (
              <View style={[styles.infoPill, styles.pricePill]}>
                <Text style={styles.pricePillText}>
                  {formatPriceLabel(place.priceRange, t)}
                </Text>
              </View>
            )}
            {typeof place?.googleRating === 'number' && place.googleRating > 0 && (
              <View style={[styles.infoPill, styles.ratingPill]}>
                <MaterialCommunityIcons name="star" size={13} color="#b45309" />
                <Text style={styles.ratingPillText}>
                  {place.googleRating.toFixed(1)}
                  {typeof place.googleReviewCount === 'number' && place.googleReviewCount > 0
                    ? ` · ${place.googleReviewCount}`
                    : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {why.length > 0 && (
          <View style={styles.whyBlock}>
            <Text style={styles.sectionLabel}>{t('place.whyThisPlace')}</Text>
            <Text style={styles.description}>{why}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCard,
  },
  contentContainer: {
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  topMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sunsetOrange + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  timeIconBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
  travelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  travelPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: '#0369a1',
  },
  name: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.deepOcean,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  neighborhood: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  infoPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  pricePill: {
    backgroundColor: colors.successEmerald + '15',
  },
  pricePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#059669',
  },
  ratingPill: {
    backgroundColor: '#fffbeb',
  },
  ratingPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#b45309',
  },
  whyBlock: {
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMain,
  },
});
