import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';

interface Stop {
  id: string;
  name: string;
  category?: string;
  neighborhood?: string;
  photos?: { url: string }[];
  whyThisPlace?: string;
  duration?: number;
  priceRange?: string;
  googleRating?: number | null;
  googleReviewCount?: number | null;
  timeBlock?: string;
  suggestedArrival?: string;
  travelFromPrevious?: {
    distance_km: number;
    duration_min: number;
    mode: string;
  } | null;
}

interface StopCardProps {
  stop: Stop;
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
  const photoUrl = stop.photos?.[0]?.url;
  const categoryColor = CATEGORY_COLOR[stop.category ?? 'Culture'] ?? '#0f172a';

  const timeIcon = stop.timeBlock ? TIME_BLOCK_ICON[stop.timeBlock] ?? DEFAULT_STOP_ICON : null;
  const travel = stop.travelFromPrevious;
  const why = stop.whyThisPlace ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      scrollEnabled
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <PhotoHero
        imageUrl={photoUrl}
        fallbackCategory={(stop.category as Category) || 'Culture'}
        height={180}
        blurBackdrop
      />

      <View style={styles.content}>
        {(timeIcon || stop.suggestedArrival) && (
          <View style={styles.topMetaRow}>
            {timeIcon && (
              <View style={styles.timePill}>
                <View style={styles.timeIconBubble}>
                  <MaterialCommunityIcons name={timeIcon} size={12} color={colors.sunsetOrange} />
                </View>
                {stop.suggestedArrival && (
                  <Text style={styles.timePillText}>{stop.suggestedArrival}</Text>
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
                  {Math.round(travel.duration_min)}m from prev
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.name}>{stop.name}</Text>

        <View style={styles.metaRow}>
          {stop.category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
              <Text style={styles.categoryText}>{stop.category}</Text>
            </View>
          )}
          {stop.neighborhood && (
            <View style={styles.neighborhoodRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.neighborhood}>{stop.neighborhood}</Text>
            </View>
          )}
        </View>

        {(stop.duration || stop.priceRange || stop.googleRating) && (
          <View style={styles.infoRow}>
            {stop.duration && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.deepOcean} />
                <Text style={styles.infoPillText}>{formatDuration(stop.duration)}</Text>
              </View>
            )}
            {stop.priceRange && (
              <View style={[styles.infoPill, styles.pricePill]}>
                <Text style={styles.pricePillText}>{stop.priceRange}</Text>
              </View>
            )}
            {typeof stop.googleRating === 'number' && stop.googleRating > 0 && (
              <View style={[styles.infoPill, styles.ratingPill]}>
                <MaterialCommunityIcons name="star" size={13} color="#b45309" />
                <Text style={styles.ratingPillText}>
                  {stop.googleRating.toFixed(1)}
                  {typeof stop.googleReviewCount === 'number' && stop.googleReviewCount > 0
                    ? ` · ${stop.googleReviewCount}`
                    : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {why.length > 0 && (
          <View style={styles.whyBlock}>
            <Text style={styles.sectionLabel}>Why this place</Text>
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
