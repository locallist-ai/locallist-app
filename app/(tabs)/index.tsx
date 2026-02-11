import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useApi } from '../../hooks/useApi';
import { colors, spacing, fonts } from '../../lib/theme';
import { useAuth } from '../../lib/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Plan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  imageUrl: string | null;
  type: string;
  isShowcase: boolean;
}

const CATEGORIES = [
  { label: 'Food', icon: '\u{1F37D}', color: '#ef4444' },
  { label: 'Nightlife', icon: '\u{1F378}', color: '#8b5cf6' },
  { label: 'Outdoors', icon: '\u{1F3D6}', color: '#10b981' },
  { label: 'Coffee', icon: '\u2615', color: '#f59e0b' },
  { label: 'Culture', icon: '\u{1F3A8}', color: '#3b82f6' },
  { label: 'Wellness', icon: '\u{1F9D8}', color: '#ec4899' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { isPro } = useAuth();
  const { data, isLoading } = useApi<{ plans: Plan[] }>('/plans?showcase=true', {
    auth: false,
  });

  // Staggered animations
  const fadeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const slideAnims = useRef([
    new Animated.Value(30),
    new Animated.Value(30),
    new Animated.Value(30),
    new Animated.Value(30),
  ]).current;

  useEffect(() => {
    const animations = fadeAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          delay: i * 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 600,
          delay: i * 150,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(100, animations).start();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Hero ─────────────────────────────────── */}
      <View style={styles.hero}>
        {/* Decorative gradient orbs (like landing) */}
        <View style={styles.orbContainer}>
          <View style={[styles.orb, styles.orb1]} />
          <View style={[styles.orb, styles.orb2]} />
        </View>

        <Animated.View style={{ opacity: fadeAnims[0], transform: [{ translateY: slideAnims[0] }] }}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.heroIcon}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnims[1], transform: [{ translateY: slideAnims[1] }] }}>
          <Text style={styles.heroTitle}>
            <Text style={styles.heroTitleSerif}>Stop researching.{'\n'}</Text>
            <Text style={styles.heroTitleAccent}>Start traveling.</Text>
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnims[2], transform: [{ translateY: slideAnims[2] }] }}>
          <Text style={styles.heroSubtitle}>
            No endless options. No tourist traps.{'\n'}Just a plan built to be followed.
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnims[3], transform: [{ translateY: slideAnims[3] }] }}>
          <TouchableOpacity
            style={styles.heroCta}
            activeOpacity={0.85}
            onPress={() => router.push('/builder')}
          >
            <Text style={styles.heroCtaText}>Build Your Plan</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ─── Categories ───────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Explore by Category</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={styles.categoryCard}
              activeOpacity={0.8}
              onPress={() =>
                router.push(`/(tabs)/plans?category=${cat.label.toLowerCase()}`)
              }
            >
              <View style={[styles.categoryIconBg, { backgroundColor: cat.color + '15' }]}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── Featured Plans ───────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Plans</Text>
        <Text style={styles.sectionSubtitle}>
          Curated by locals. Ready to follow.
        </Text>

        {isLoading && (
          <View style={styles.loadingContainer}>
            {[1, 2].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonImage} />
                <View style={styles.skeletonText} />
                <View style={[styles.skeletonText, { width: '60%' }]} />
              </View>
            ))}
          </View>
        )}

        {!isLoading && (!data?.plans || data.plans.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u{1F334}'}</Text>
            <Text style={styles.emptyTitle}>Plans are being curated</Text>
            <Text style={styles.emptyText}>
              Our team is handpicking the best spots in Miami. Check back soon!
            </Text>
          </View>
        )}

        {data?.plans?.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={styles.planCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/plan/${plan.id}`)}
          >
            {plan.imageUrl ? (
              <Image source={{ uri: plan.imageUrl }} style={styles.planImage} />
            ) : (
              <LinearGradient
                colors={['#1e3a4f', '#4eb4e6']}
                style={styles.planImage}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.planImagePlaceholder}>{'\u{1F5FA}'}</Text>
              </LinearGradient>
            )}
            <View style={styles.planInfo}>
              <View style={styles.planBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {plan.durationDays} {plan.durationDays === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                {plan.isShowcase && (
                  <View style={[styles.badge, styles.badgeFeatured]}>
                    <Text style={[styles.badgeText, styles.badgeFeaturedText]}>
                      {'\u2B50'} Featured
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.planName}>{plan.name}</Text>
              {plan.description && (
                <Text style={styles.planDescription} numberOfLines={2}>
                  {plan.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── Quality Promise ──────────────────────── */}
      <View style={styles.qualitySection}>
        <View style={styles.qualityCard}>
          <Text style={styles.qualityBadge}>Only The Best</Text>
          <Text style={styles.qualityTitle}>Nothing Else.</Text>
          <Text style={styles.qualityText}>
            Every place passes a multi-factor quality analysis.
            If it's not genuinely great, it doesn't make the cut.
          </Text>
          <View style={styles.qualityStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>Top 5%</Text>
              <Text style={styles.statLabel}>Acceptance Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>0 Ads</Text>
              <Text style={styles.statLabel}>100% Unbiased</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>Local</Text>
              <Text style={styles.statLabel}>Verified Places</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    paddingBottom: 40,
  },

  // ─── Hero ─────────────────────────────────
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 48,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  orbContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 300,
    height: 300,
    top: -80,
    left: -60,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  orb2: {
    width: 250,
    height: 250,
    top: 40,
    right: -80,
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
  },
  heroIcon: {
    width: 72,
    height: 90,
    marginBottom: 24,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  heroTitleSerif: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.deepOcean,
    lineHeight: 40,
  },
  heroTitleAccent: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.electricBlue,
    lineHeight: 40,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: spacing.md,
  },
  heroCta: {
    backgroundColor: colors.electricBlue,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: colors.electricBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heroCtaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // ─── Section ──────────────────────────────
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: colors.deepOcean,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },

  // ─── Categories ───────────────────────────
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  categoryCard: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - 24) / 3,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMain,
  },

  // ─── Plan Cards ───────────────────────────
  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  planImage: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planImagePlaceholder: {
    fontSize: 48,
    opacity: 0.6,
  },
  planInfo: {
    padding: 16,
  },
  planBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: colors.bgMain,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  badgeFeatured: {
    backgroundColor: '#fef3c7',
  },
  badgeFeaturedText: {
    color: '#92400e',
  },
  planName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: 4,
  },
  planDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ─── Loading Skeleton ─────────────────────
  loadingContainer: {
    gap: 16,
  },
  skeletonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  skeletonImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    backgroundColor: '#e5e5e5',
  },
  skeletonText: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e5e5e5',
    width: '80%',
  },

  // ─── Empty State ──────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ─── Quality Promise ──────────────────────
  qualitySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: 16,
  },
  qualityCard: {
    backgroundColor: colors.deepOcean,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  qualityBadge: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  qualityTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  qualityText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  qualityStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: '#64748b',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#334155',
  },
});
