import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import { CategoryBadge } from '../ui/CategoryBadge';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { formatPriceLabel } from '../../lib/helpers/price';
import { TIME_BLOCK_ICON } from '../../lib/timeBlocks';
import { usePlanEditorModals } from './PlanEditorModals';
import type { PlanStop } from '../../lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DayStopsCarouselProps {
  stops: PlanStop[];
  dayNumber: number;
  isOwner: boolean;
}

// Renders one full-width slide per stop of the current day. Lives inside the
// pager's horizontal paging ScrollView, so each slide must keep SCREEN_WIDTH.
export const DayStopsCarousel: React.FC<DayStopsCarouselProps> = ({ stops, dayNumber, isOwner }) => {
  const { requestReplace } = usePlanEditorModals();

  return (
    <>
      {stops.map((stop, idx) => (
        <StopSlot
          key={`${stop.placeId}-${idx}`}
          stop={stop}
          index={idx}
          total={stops.length}
          isOwner={isOwner}
          dayNumber={dayNumber}
          stopIndex={idx}
          onRequestReplace={isOwner ? requestReplace : undefined}
        />
      ))}
    </>
  );
};

/* ───── Stop Slot ───── */

interface StopSlotProps {
  stop: PlanStop;
  index: number;
  total: number;
  isOwner?: boolean;
  dayNumber?: number;
  stopIndex?: number;
  onRequestReplace?: (dayNumber: number, stopIndex: number) => void;
}

const StopSlot: React.FC<StopSlotProps> = React.memo(({ stop, index, total, isOwner, dayNumber, stopIndex, onRequestReplace }) => {
  const { t } = useTranslation();
  const [photoIdx, setPhotoIdx] = useState(0);
  const place = stop.place;
  const photos = place?.photos ?? [];
  const activePhoto = photos[photoIdx];
  const fallbackCategory = (place?.category ?? 'Culture') as Category;
  const timeIcon = stop.timeBlock ? TIME_BLOCK_ICON[stop.timeBlock] ?? null : null;
  const why = place?.whyThisPlace ?? '';

  const chipTokens = useMemo(() => {
    const tokens: string[] = [];
    if (place?.bestTime) tokens.push(place.bestTime);
    if (place?.suitableFor) tokens.push(...place.suitableFor.slice(0, 3));
    if (place?.bestFor) tokens.push(...place.bestFor.slice(0, 2));
    return Array.from(new Set(tokens)).slice(0, 5);
  }, [place]);

  return (
    <ScrollView
      style={styles.slot}
      contentContainerStyle={styles.slotContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stopHeroWrap}>
        <PhotoHero
          imageUrl={activePhoto}
          fallbackCategory={fallbackCategory}
          height={260}
          blurBackdrop
        />
        {timeIcon && (
          <View style={styles.timeOverlay}>
            <View style={styles.timeOverlayBubble}>
              <MaterialCommunityIcons name={timeIcon} size={12} color={colors.sunsetOrange} />
            </View>
            {stop.suggestedArrival && (
              <Text style={styles.timeOverlayText}>{stop.suggestedArrival}</Text>
            )}
          </View>
        )}
        <View style={styles.stopCounterOverlay}>
          <Text style={styles.stopCounterText}>
            {index + 1} / {total}
          </Text>
        </View>
        {photos.length > 1 && (
          <View style={styles.photoDots}>
            {photos.slice(0, 6).map((url, i) => (
              <TouchableOpacity
                key={`${stop.placeId}-photo-${url ?? i}`}
                onPress={() => setPhotoIdx(i)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${i + 1}`}
                style={[styles.photoDot, i === photoIdx && styles.photoDotActive]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.stopMetaTop}>
          <CategoryBadge category={place?.category} size="sm" />
          {place?.neighborhood && (
            <View style={styles.neighRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.neighText}>{place.neighborhood}</Text>
            </View>
          )}
        </View>

        <Text style={styles.stopName}>{place?.name ?? t('plan.unknownPlace')}</Text>

        {chipTokens.length > 0 && (
          <View style={styles.chipsRow}>
            {chipTokens.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {(stop.suggestedDurationMin || place?.priceRange || (place?.googleRating ?? 0) > 0 || stop.travelFromPrevious) && (
          <View style={styles.infoRow}>
            {stop.suggestedDurationMin != null && (
              <View style={styles.infoPill}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.electricBlue} />
                <Text style={styles.infoPillText}>
                  {stop.suggestedDurationMin >= 60
                    ? t('stop.visitDurationLong', { h: Math.round(stop.suggestedDurationMin / 60) })
                    : t('stop.visitDuration', { min: stop.suggestedDurationMin })}
                </Text>
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
            {stop.travelFromPrevious && stop.travelFromPrevious.duration_min > 0 && (
              <View style={[styles.infoPill, styles.travelPill]}>
                <MaterialCommunityIcons
                  name={stop.travelFromPrevious.mode === 'walk' ? 'walk' : 'car'}
                  size={13}
                  color="#0369a1"
                />
                <Text style={styles.travelPillText}>
                  {t('stop.travelFromPrev', { min: Math.round(stop.travelFromPrevious.duration_min) })}
                </Text>
              </View>
            )}
          </View>
        )}

        {why.length > 0 && (
          <View style={styles.whyBlock}>
            <Text style={styles.sectionLabel}>{t('place.whyThisPlace')}</Text>
            <Text style={styles.whyText}>{why}</Text>
          </View>
        )}

        {isOwner && onRequestReplace && (
          <TouchableOpacity
            style={styles.replaceBtn}
            onPress={() => onRequestReplace(dayNumber!, stopIndex!)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Replace this stop"
          >
            <Ionicons name="swap-horizontal-outline" size={15} color={colors.sunsetOrange} />
            <Text style={styles.replaceBtnText}>{t('plan.replaceStop')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
});
StopSlot.displayName = 'StopSlot';

/* ───── Styles ───── */

const styles = StyleSheet.create({
  slot: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.bgCard,
  },
  slotContent: {
    flexGrow: 1,
    paddingBottom: 110,
    backgroundColor: colors.bgCard,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
  },

  /* Stop hero overlays */
  stopHeroWrap: {
    position: 'relative',
  },
  timeOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  timeOverlayBubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOverlayText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.deepOcean },
  stopCounterOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  stopCounterText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#FFFFFF' },
  photoDots: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },

  /* Stop content */
  stopMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  neighText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  stopName: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.deepOcean,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.sunsetOrange + '35',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.deepOcean,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.electricBlue + '10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  infoPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.electricBlue,
  },
  pricePill: { backgroundColor: colors.successEmerald + '15' },
  pricePillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#059669' },
  ratingPill: { backgroundColor: '#fffbeb' },
  ratingPillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: '#b45309' },
  travelPill: { backgroundColor: '#e0f2fe' },
  travelPillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: '#0369a1' },

  replaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.sunsetOrange + '40',
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: colors.sunsetOrange + '08',
    marginTop: spacing.xs,
  },
  replaceBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.sunsetOrange,
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
  whyText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMain },
});
