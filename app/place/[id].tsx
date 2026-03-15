import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { PhotoHero, type Category } from '../../components/ui/PhotoHero';
import type { Place } from '../../lib/types';

// ── Constants ──

const HERO_MAX = 280;
const HERO_MIN = 120;

const PRICE_KEYS: Record<string, string> = {
  $: 'place.priceBudget',
  $$: 'place.priceModerate',
  $$$: 'place.priceUpscale',
  $$$$: 'place.priceFineDining',
};

const TIME_BLOCK_KEYS: Record<string, { icon: keyof typeof Ionicons.glyphMap; labelKey: string }> = {
  morning: { icon: 'sunny-outline', labelKey: 'place.timeMorning' },
  lunch: { icon: 'restaurant-outline', labelKey: 'place.timeLunch' },
  afternoon: { icon: 'cafe-outline', labelKey: 'place.timeAfternoon' },
  dinner: { icon: 'moon-outline', labelKey: 'place.timeDinner' },
  evening: { icon: 'musical-notes-outline', labelKey: 'place.timeEvening' },
};

// ── Component ──

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parallax scroll tracking
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HERO_MAX - HERO_MIN],
      [HERO_MAX, HERO_MIN],
      Extrapolate.CLAMP,
    );
    return { height };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<Place>(`/places/${id}`);
        if (cancelled) return;
        if (res.data) {
          setPlace(res.data);
        } else {
          setError(res.error ?? t('place.loadError'));
        }
      } catch {
        if (!cancelled) setError(t('place.networkError'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const openInMaps = () => {
    if (!place?.latitude || !place?.longitude) return;
    const lat = place.latitude;
    const lng = place.longitude;
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  // ── Loading state ──

  if (loading) {
    return (
      <View style={s.center} accessibilityLabel={t('common.appName')} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  // ── Error state ──

  if (error || !place) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error ?? t('place.notFound')}</Text>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          accessibilityLabel={t('place.goBack')}
          accessibilityRole="button"
        >
          <Text style={s.backBtnText}>{t('place.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived data ──

  const heroImageUrl = place.photos?.[0] ?? undefined;
  const heroFallbackCategory = (place.category ?? 'Culture') as Category;
  const heroSubtitle = [place.neighborhood, place.city].filter(Boolean).join(' \u00B7 ');
  const bestTimeInfo = place.bestTime ? TIME_BLOCK_KEYS[place.bestTime] : null;
  const hasCoords = place.latitude && place.longitude;

  // ── Render ──

  return (
    <View style={s.root}>
      {/* Hero parallax */}
      <Animated.View style={[s.heroContainer, heroAnimatedStyle]}>
        <PhotoHero
          imageUrl={heroImageUrl}
          fallbackCategory={heroFallbackCategory}
          title={place.name}
          subtitle={heroSubtitle}
          height={HERO_MAX}
          withSafeArea
        />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: HERO_MAX + spacing.md }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Badges */}
        <View style={s.badges}>
          <View style={s.badge}>
            <Ionicons name="pricetag-outline" size={14} color={colors.deepOcean} />
            <Text style={s.badgeText}>{place.category}</Text>
          </View>
          {place.priceRange && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{place.priceRange}</Text>
            </View>
          )}
          {place.googleRating && (
            <View style={[s.badge, { backgroundColor: 'rgba(250, 204, 21, 0.12)' }]}>
              <Ionicons name="star" size={13} color="#f59e0b" />
              <Text style={s.badgeText}>
                {place.googleRating}{place.googleReviewCount ? ` (${place.googleReviewCount})` : ''}
              </Text>
            </View>
          )}
          {place.subcategory && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{place.subcategory}</Text>
            </View>
          )}
        </View>

        {/* Why This Place */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="sparkles" size={18} color={colors.sunsetOrange} />
            <Text style={s.cardTitle}>{t('place.whyThisPlace')}</Text>
          </View>
          <Text style={s.whyText}>{place.whyThisPlace}</Text>
        </View>

        {/* Details section */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('place.details')}</Text>

          {/* Best For */}
          {place.bestFor && place.bestFor.length > 0 && (
            <View style={s.detailRow}>
              <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>{t('place.bestFor')}</Text>
                <View style={s.chipRow}>
                  {place.bestFor.map((item) => (
                    <View key={item} style={s.chip}>
                      <Text style={s.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Suitable For */}
          {place.suitableFor && place.suitableFor.length > 0 && (
            <View style={s.detailRow}>
              <Ionicons name="heart-outline" size={18} color={colors.textSecondary} />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>{t('place.suitableFor')}</Text>
                <View style={s.chipRow}>
                  {place.suitableFor.map((item) => (
                    <View key={item} style={s.chip}>
                      <Text style={s.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Best Time */}
          {bestTimeInfo && (
            <View style={s.detailRow}>
              <Ionicons name={bestTimeInfo.icon} size={18} color={colors.textSecondary} />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>{t('place.bestTime')}</Text>
                <Text style={s.detailValue}>{t(bestTimeInfo.labelKey)}</Text>
              </View>
            </View>
          )}

          {/* Price Range */}
          {place.priceRange && (
            <View style={s.detailRow}>
              <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>{t('place.priceRange')}</Text>
                <Text style={s.detailValue}>
                  {place.priceRange} {PRICE_KEYS[place.priceRange] ? `\u2014 ${t(PRICE_KEYS[place.priceRange])}` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Location */}
          {place.neighborhood && (
            <View style={s.detailRow}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>{t('place.neighborhood')}</Text>
                <Text style={s.detailValue}>{place.neighborhood}, {place.city}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Source attribution */}
        {place.source && place.source !== 'curated' && (
          <Text style={s.sourceText}>{t('place.source')}: {place.source}</Text>
        )}

        <View style={{ height: hasCoords ? 100 : spacing.xl }} />
      </Animated.ScrollView>

      {/* Bottom CTA: Open in Maps */}
      {hasCoords && (
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openInMaps}
            accessibilityLabel={t('place.openInMaps')}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[colors.sunsetOrange, '#ea580c']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.mapBtnGradient}
            >
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text style={s.mapBtnText}>{t('place.openInMaps')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scroll: { padding: spacing.lg },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.electricBlue,
  },
  backBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#FFFFFF' },

  heroContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },

  // Badges
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.50)',
  },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.deepOcean },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.deepOcean,
    marginBottom: spacing.sm,
  },
  whyText: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMain,
    fontStyle: 'italic',
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderColor,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
  },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    backgroundColor: colors.electricBlue + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.electricBlue },

  // Source
  sourceText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgMain,
  },
  mapBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
  },
  mapBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
