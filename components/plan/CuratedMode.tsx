import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, RefreshControl } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import type { ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { PhotoHero, type Category } from '../ui/PhotoHero';
import { EditorialTitle } from '../ui/design-system';
import type { Plan } from '../../lib/types';

// Local cover images generated with Remotion (keyed by plan name)
const PLAN_COVERS: Record<string, ImageSourcePropType> = {
  'Romantic Weekend in Miami': require('../../assets/images/plans/romantic-weekend.webp'),
  'Foodie Weekend: Best Bites of Miami': require('../../assets/images/plans/foodie-weekend.webp'),
  'Outdoor Adventure Day': require('../../assets/images/plans/outdoor-adventure.webp'),
  'Family Fun in Miami': require('../../assets/images/plans/family-fun.webp'),
  'Culture & Art Crawl': require('../../assets/images/plans/culture-art-crawl.webp'),
};

// Glass-like translucent backgrounds
const GLASS_BG = 'rgba(255, 255, 255, 0.82)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.50)';

type Props = {
  insets: EdgeInsets;
  plans: Plan[];
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
};

export function CuratedMode({ insets, plans, error, refreshing, onRefresh, onBack }: Props) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter plans based on selected category
  const filteredPlans = selectedCategory
    ? plans.filter((p) => p.category === selectedCategory)
    : plans;

  // Get unique categories from plans
  const categories = Array.from(new Set(plans.map((p) => p.category).filter((c): c is string => Boolean(c))));

  return (
    <>
      <TouchableOpacity
        onPress={onBack}
        style={[s.floatingClose, { top: insets.top + spacing.xs }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Back to plans menu"
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Header on hero */}
      <View style={[s.curatedHeader, { paddingTop: insets.top + spacing.xs + 56 }]}>
        <EditorialTitle text={t('plans.exploreCurated')} size="md" align="left" color="#FFFFFF" withShadow />
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsContainer}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => setSelectedCategory((prev) => (prev === category ? null : category))}
            style={[s.chip, selectedCategory === category && s.chipActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, selectedCategory === category && s.chipTextActive]}>{category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Plans List */}
      {error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onRefresh}>
            <Text style={s.retryText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPlans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.electricBlue} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="map-outline" size={56} color={colors.sunsetOrange} />
              <Text style={[s.emptyTitle, s.emptyTitleOnHero]}>
                {selectedCategory ? t('plans.emptyCuratedFilteredTitle') : t('plans.emptyCuratedNoCategoryTitle')}
              </Text>
              <Text style={[s.emptyBody, s.emptyBodyOnHero]}>
                {selectedCategory ? t('plans.emptyCuratedFilteredBody') : t('plans.emptyCuratedNoCategoryBody')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 80)}>
              <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => router.push(`/plan/${item.id}`)}>
                <PhotoHero
                  localImage={PLAN_COVERS[item.name]}
                  imageUrl={item.image ?? undefined}
                  fallbackCategory={(item.category as Category) || 'Culture'}
                  height={200}
                />

                <View style={s.cardContent}>
                  <View style={s.cardHeader}>
                    <View style={s.cardLeadingIcon}>
                      <MaterialCommunityIcons name="map-marker-radius" size={18} color={colors.sunsetOrange} />
                    </View>
                    <Text style={s.cardName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.type && (
                      <View style={s.typeBadge}>
                        <Text style={s.typeBadgeText}>{t(`planType.${item.type}`, { defaultValue: item.type })}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.cardMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.sunsetOrange} />
                    <Text style={s.metaText}>{item.city}</Text>
                    <Ionicons name="calendar-outline" size={14} color={colors.sunsetOrange} style={{ marginLeft: 12 }} />
                    <Text style={s.metaText}>{t('common.dayCount', { count: item.durationDays })}</Text>
                  </View>

                  {item.description && (
                    <Text style={s.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  floatingClose: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  curatedHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // Filter chips
  chipsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: GLASS_BG,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  chipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.deepOcean,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // List
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Error
  errorText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.electricBlue,
  },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#FFFFFF' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.deepOcean,
    marginTop: spacing.md,
  },
  emptyTitleOnHero: {
    color: colors.sunsetOrange,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyBodyOnHero: {
    color: colors.sunsetOrange + 'D9', // ~85% alpha — un poco más suave
    textShadowColor: 'rgba(0,0,0,0.30)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.md, // 16 — separación entre imagen y título (rule of 4px)
  },
  cardHeader: {
    flexDirection: 'row',
    // Pablo 2026-04-27: badge alineado con la PRIMERA línea del título,
    // independientemente de cuántas líneas tenga el título. flex-start hace
    // que badge + texto + icon top-aligned con la primera línea.
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: spacing.sm,
  },
  cardLeadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
    flex: 1,
  },
  typeBadge: {
    backgroundColor: colors.sunsetOrange + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  typeBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.sunsetOrange },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMain,
  },
});
