import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { PhotoHero } from '../../components/ui/PhotoHero';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import type { Plan } from '../../lib/types';
import type { ImageSourcePropType } from 'react-native';

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

export default function PlansScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { height: screenHeight } = useWindowDimensions();

  const fetchPlans = useCallback(async () => {
    const res = await api<{ plans: Plan[] }>('/plans?showcase=true');
    if (res.data) {
      setPlans(res.data.plans ?? []);
      setError(null);
    } else {
      setError(res.error ?? 'Failed to load plans');
    }
  }, []);

  useEffect(() => {
    fetchPlans().finally(() => setLoading(false));
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlans();
    setRefreshing(false);
  }, [fetchPlans]);

  // Filter plans based on selected category
  const filteredPlans = selectedCategory
    ? plans.filter(p => p.category === selectedCategory)
    : plans;

  // Get unique categories from plans
  const categories = Array.from(new Set(plans.map(p => p.category).filter(Boolean)));

  if (loading) {
    return (
      <View style={s.root}>
        {/* Background image with overlay */}
        <Image
          source={require('../../assets/images/plans-bg.webp')}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: -100,
            width: '100%',
            height: screenHeight + 100,
          }}
          resizeMode="cover"
        />
        {/* Soft overlay */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: -100,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
          }}
        />

        <View style={s.skeletonContainer}>
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Background image with overlay */}
      <Image
        source={require('../../assets/images/plans-bg.webp')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -100,
          width: '100%',
          height: screenHeight + 100,
        }}
        resizeMode="cover"
      />
      {/* Soft overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: -100,
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
        }}
      />

      {/* Filter Chips */}
      <Animated.View entering={FadeInDown.duration(600).delay(300).springify()}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() =>
                setSelectedCategory(prev => prev === category ? null : category)
              }
              style={[
                s.chip,
                selectedCategory === category && s.chipActive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.chipText,
                  selectedCategory === category && s.chipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Plans List */}
      {error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onRefresh}>
            <Text style={s.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredPlans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.electricBlue}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="map-outline" size={56} color={colors.textSecondary + '60'} />
              <Text style={s.emptyTitle}>
                {selectedCategory ? 'No plans in this category' : 'No plans yet'}
              </Text>
              <Text style={s.emptyBody}>
                {selectedCategory
                  ? 'Try another category'
                  : 'Create your first plan from the Home tab'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 80)}>
              <TouchableOpacity
                style={s.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/plan/${item.id}`)}
              >
                {/* Full-bleed image with PhotoHero */}
                <PhotoHero
                  localImage={PLAN_COVERS[item.name]}
                  imageUrl={item.image}
                  fallbackCategory={(item.category as any) || 'Culture'}
                  height={200}
                />

                {/* Card content with gradient overlay on lower half */}
                <View style={s.cardContent}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.type && (
                      <View style={s.typeBadge}>
                        <Text style={s.typeBadgeText}>{item.type}</Text>
                      </View>
                    )}
                  </View>

                  <View style={s.cardMeta}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={s.metaText}>{item.city}</Text>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={colors.textSecondary}
                      style={{ marginLeft: 12 }}
                    />
                    <Text style={s.metaText}>
                      {item.durationDays} {item.durationDays === 1 ? 'day' : 'days'}
                    </Text>
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  // Skeleton loading
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Filter chips (glass-morphism effect)
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
    backgroundColor: colors.electricBlue,
    borderColor: colors.electricBlue,
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
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Card with full-bleed image
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  // Card content (below image)
  cardContent: {
    padding: spacing.md,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: spacing.sm,
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
