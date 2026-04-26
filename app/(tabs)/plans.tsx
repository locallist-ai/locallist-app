import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import { router, useNavigation, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getCached, setCache, isFresh } from '../../lib/api-cache';
import { PhotoHero, type Category } from '../../components/ui/PhotoHero';
import { SkeletonCard } from '../../components/ui/SkeletonCard';
import { EditorialTitle, StepSubtitle } from '../../components/ui/design-system';
import type { Plan } from '../../lib/types';
import type { ImageSourcePropType } from 'react-native';

const PLANS_CACHE_KEY = 'plans_showcase';

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

/** Sort plans with "Family Fun in Miami" pinned first */
function sortPlans(list: Plan[]): Plan[] {
  return [...list].sort((a, b) => {
    if (a.name === 'Family Fun in Miami') return -1;
    if (b.name === 'Family Fun in Miami') return 1;
    return 0;
  });
}

type PlansMode = 'chooser' | 'curated' | 'mine';

// Bg layer compartido — misma estética que el wizard (HomeV2). Imagen de hero
// fija + dark overlay para legibilidad de texto blanco encima. Pablo 2026-04-25:
// "la página de my plans debe seguir la estética de las páginas del wizard,
// debemos crear una imagen de fondo también para ella."
const PlansHeroBg: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <>
    <Image
      source={require('../../assets/images/hero-bg.jpg')}
      style={[{ position: 'absolute', top: -100, left: -100, width: width + 200, height: height + 300 }]}
      resizeMode="cover"
    />
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.45)' }} />
  </>
);

export default function PlansScreen() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [mode, setMode] = useState<PlansMode>('chooser');
  const [myPlans, setMyPlans] = useState<Plan[]>([]);

  // Fetch user's plans when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      (async () => {
        const res = await api<{ plans: Plan[] }>('/plans/mine');
        if (res.data) setMyPlans(res.data.plans ?? []);
      })();
    }, [isAuthenticated])
  );

  // El header nativo se queda oculto en TODOS los modos para que el bg hero
  // se vea full-screen. El back/close de mine/curated se renderiza como
  // floating pill encima del bg.
  useEffect(() => {
    navigation.setOptions({ headerShown: false, headerLeft: undefined });
  }, [navigation]);

  // Stale-while-revalidate: show cached data instantly (preloaded during splash)
  const cached = getCached<Plan[]>(PLANS_CACHE_KEY);
  const [plans, setPlans] = useState<Plan[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    const res = await api<{ plans: Plan[] }>('/plans?showcase=true');
    if (res.data) {
      const list = sortPlans(res.data.plans ?? []);
      setPlans(list);
      setCache(PLANS_CACHE_KEY, list);
      setError(null);
    } else if (!cached) {
      setError(res.error ?? 'Failed to load plans');
    }
  }, []);

  useEffect(() => {
    if (cached && isFresh(PLANS_CACHE_KEY)) {
      setLoading(false);
      return;
    }
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
  const categories = Array.from(new Set(plans.map(p => p.category).filter((c): c is string => Boolean(c))));

  if (loading && mode === 'curated') {
    return (
      <View style={s.root}>
        <View style={s.skeletonContainer}>
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
          <SkeletonCard height={280} imageHeight={180} />
        </View>
      </View>
    );
  }

  if (mode === 'chooser') {
    const chooserCards: Array<{
      icon: keyof typeof MaterialCommunityIcons.glyphMap;
      title: string;
      sub: string;
      onPress: () => void;
      badge?: string;
    }> = [
      {
        icon: 'compass-outline',
        title: t('plans.exploreCurated'),
        sub: t('plans.exploreCuratedSub'),
        onPress: () => {
          setMode('curated');
          if (!cached) fetchPlans().finally(() => setLoading(false));
        },
      },
      {
        icon: 'creation',
        title: t('plans.buildYourOwn'),
        sub: t('plans.buildYourOwnSub'),
        onPress: () => router.push('/builder/custom'),
        badge: 'Plus',
      },
      {
        icon: 'movie-open-outline',
        title: t('plans.importVideo'),
        sub: t('plans.importVideoSub'),
        onPress: () => router.push('/builder/import-video'),
      },
      ...(isAuthenticated
        ? [
            {
              icon: 'pin-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
              title: t('plans.myPlans'),
              sub:
                myPlans.length > 0
                  ? t('plans.myPlansCount', { count: myPlans.length, s: myPlans.length === 1 ? '' : 's' })
                  : t('plans.myPlansEmpty'),
              onPress: () => setMode('mine'),
            },
          ]
        : []),
    ];
    return (
      <View style={s.root}>
        <PlansHeroBg width={screenWidth} height={screenHeight} />
        <ScrollView
          contentContainerStyle={[s.chooserContainer, { paddingTop: insets.top + spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.chooserHeader}>
            <EditorialTitle text={t('plans.chooserTitle')} size="md" align="left" color="#FFFFFF" withShadow />
            <StepSubtitle
              text={t('plans.chooserSubtitle')}
              size="md"
              align="left"
              color="rgba(255,255,255,0.75)"
              withShadow
              style={{ marginTop: 8 }}
            />
          </View>

          {chooserCards.map((card, idx) => (
            <Animated.View key={card.title} entering={FadeInDown.delay(idx * 70).duration(380)}>
              <TouchableOpacity activeOpacity={0.85} onPress={card.onPress}>
                <BlurView intensity={50} tint="light" style={s.chooserCard}>
                  <View style={s.chooserIconBubble}>
                    <MaterialCommunityIcons name={card.icon} size={26} color={colors.sunsetOrange} />
                  </View>
                  <View style={s.chooserTextWrap}>
                    <View style={s.chooserTitleRow}>
                      <Text style={s.chooserTitle}>{card.title}</Text>
                      {card.badge && (
                        <View style={s.plusBadge}>
                          <Text style={s.plusBadgeText}>{card.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.chooserSub}>{card.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (mode === 'mine') {
    return (
      <View style={s.root}>
        <PlansHeroBg width={screenWidth} height={screenHeight} />
        <TouchableOpacity
          onPress={() => setMode('chooser')}
          style={[s.floatingClose, { top: insets.top + spacing.xs }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to plans menu"
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        {myPlans.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="bookmark-outline" size={56} color="rgba(255,255,255,0.6)" />
            <Text style={[s.emptyTitle, s.emptyTitleOnHero]}>No plans yet</Text>
            <Text style={[s.emptyBody, s.emptyBodyOnHero]}>
              Create your first plan with "Build Your Own"
            </Text>
          </View>
        ) : (
          <FlatList
            data={myPlans}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.list, { paddingTop: insets.top + spacing.lg }]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={s.listHeader}>
                <EditorialTitle text={t('plans.myPlans')} size="md" align="left" color="#FFFFFF" withShadow />
                <StepSubtitle
                  text={t('plans.myPlansCount', { count: myPlans.length, s: myPlans.length === 1 ? '' : 's' })}
                  size="md"
                  align="left"
                  color="rgba(255,255,255,0.75)"
                  withShadow
                  style={{ marginTop: 6 }}
                />
              </View>
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 70).duration(380)}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push(`/plan/${item.id}`)}
                >
                  <BlurView intensity={50} tint="light" style={s.myPlanRow}>
                    <View style={s.myPlanIcon}>
                      <MaterialCommunityIcons name="map-marker-radius" size={20} color={colors.sunsetOrange} />
                    </View>
                    <View style={s.myPlanInfo}>
                      <Text style={s.myPlanName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.myPlanMeta}>
                        {item.city} · {item.durationDays} {item.durationDays === 1 ? 'day' : 'days'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                  </BlurView>
                </TouchableOpacity>
              </Animated.View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <PlansHeroBg width={screenWidth} height={screenHeight} />
      <TouchableOpacity
        onPress={() => setMode('chooser')}
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
                <PhotoHero
                  localImage={PLAN_COVERS[item.name]}
                  imageUrl={item.image ?? undefined}
                  fallbackCategory={(item.category as Category) || 'Culture'}
                  height={200}
                />

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
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
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

  // Chooser cards — lenguaje wizard (ChoiceChip-like)
  chooserContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  chooserHeader: {
    marginBottom: spacing.lg,
  },
  chooserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.sm,
  },
  chooserEmoji: {
    fontSize: 32,
  },
  chooserIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  chooserTextWrap: {
    flex: 1,
  },
  chooserTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  chooserTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusBadge: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  plusBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  chooserSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  myPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  myPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlanInfo: {
    flex: 1,
  },
  myPlanName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  myPlanMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  listHeader: {
    marginBottom: spacing.lg,
  },
  curatedHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
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
  emptyTitleOnHero: {
    color: '#FFFFFF',
  },
  emptyBodyOnHero: {
    color: 'rgba(255,255,255,0.75)',
  },

  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
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
    paddingTop: 0,
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
