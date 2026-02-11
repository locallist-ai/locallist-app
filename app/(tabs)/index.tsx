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
  { label: 'Food', icon: '\u{1F37D}', accent: '#ef4444' },
  { label: 'Nightlife', icon: '\u{1F378}', accent: '#8b5cf6' },
  { label: 'Outdoors', icon: '\u{1F3D6}', accent: '#10b981' },
  { label: 'Coffee', icon: '\u2615', accent: '#f59e0b' },
  { label: 'Culture', icon: '\u{1F3A8}', accent: '#3b82f6' },
  { label: 'Wellness', icon: '\u{1F9D8}', accent: '#ec4899' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading } = useApi<{ plans: Plan[] }>('/plans?showcase=true', {
    auth: false,
  });

  // 5-part staggered entrance
  const anims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(28),
    })),
  ).current;

  // Subtle scale for the CTA card
  const ctaScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    const entrance = anims.map((a, i) =>
      Animated.parallel([
        Animated.timing(a.opacity, {
          toValue: 1,
          duration: 520,
          delay: i * 110,
          useNativeDriver: true,
        }),
        Animated.timing(a.translateY, {
          toValue: 0,
          duration: 520,
          delay: i * 110,
          useNativeDriver: true,
        }),
      ]),
    );
    Animated.stagger(60, [
      ...entrance,
      Animated.spring(ctaScale, {
        toValue: 1,
        delay: 180,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const anim = (i: number) => ({
    opacity: anims[i].opacity,
    transform: [{ translateY: anims[i].translateY }],
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ EDITORIAL HEADER ═══════════════════════ */}
      <Animated.View style={[styles.header, anim(0)]}>
        <View style={styles.headerRow}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerDot} />
          <Text style={styles.headerLabel}>MIAMI</Text>
        </View>
        <Text style={styles.heroTitle}>LocalList</Text>
        <View style={styles.taglineRow}>
          <View style={styles.taglineRule} />
          <Text style={styles.tagline}>Only The Best. Nothing Else.</Text>
          <View style={styles.taglineRule} />
        </View>
      </Animated.View>

      {/* ═══ BUILDER CTA ════════════════════════════ */}
      <Animated.View
        style={[
          styles.ctaOuter,
          anim(1),
          { transform: [{ translateY: anims[1].translateY }, { scale: ctaScale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push('/builder')}
        >
          <LinearGradient
            colors={[colors.deepOcean, '#1a2744']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaCard}
          >
            <View style={styles.ctaTop}>
              <View style={styles.ctaBadge}>
                <Text style={styles.ctaBadgeText}>AI-POWERED</Text>
              </View>
            </View>
            <Text style={styles.ctaTitle}>Build Your Plan</Text>
            <Text style={styles.ctaSub}>
              Tell us what you love — we craft the perfect itinerary in seconds.
            </Text>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaButtonText}>Get Started</Text>
              <Text style={styles.ctaArrow}>{'\u2192'}</Text>
            </View>
            {/* Decorative corner accent */}
            <View style={styles.ctaCornerAccent} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* ═══ CATEGORIES ═════════════════════════════ */}
      <Animated.View style={[styles.section, anim(2)]}>
        <Text style={styles.sectionLabel}>EXPLORE</Text>
        <Text style={styles.sectionHeading}>What draws you in?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={styles.catPill}
              activeOpacity={0.8}
              onPress={() =>
                router.push(`/(tabs)/plans?category=${cat.label.toLowerCase()}`)
              }
            >
              <View style={[styles.catAccentBar, { backgroundColor: cat.accent }]} />
              <Text style={styles.catEmoji}>{cat.icon}</Text>
              <Text style={styles.catName}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ═══ FEATURED PLANS ═════════════════════════ */}
      <Animated.View style={[styles.section, anim(3)]}>
        <View style={styles.featuredHeader}>
          <View>
            <Text style={styles.sectionLabel}>CURATED FOR YOU</Text>
            <Text style={styles.sectionHeading}>Featured Plans</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/plans')}
            style={styles.seeAllPill}
          >
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planScroll}
          >
            {[1, 2].map((i) => (
              <View key={i} style={styles.planCard}>
                <View style={styles.skeleton} />
              </View>
            ))}
          </ScrollView>
        )}

        {!isLoading && data?.plans && data.plans.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planScroll}
            snapToInterval={SCREEN_WIDTH * 0.78 + 14}
            decelerationRate="fast"
          >
            {data.plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={styles.planCard}
                activeOpacity={0.92}
                onPress={() => router.push(`/plan/${plan.id}`)}
              >
                {/* Top accent line */}
                <View style={styles.planAccentTop} />
                {plan.imageUrl ? (
                  <Image source={{ uri: plan.imageUrl }} style={styles.planImage} />
                ) : (
                  <LinearGradient
                    colors={['#0f172a', '#1e3a5f', '#3b82f6']}
                    style={styles.planImage}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.planOverlay}
                >
                  <View style={styles.planBadges}>
                    <View style={styles.daysBadge}>
                      <Text style={styles.daysText}>
                        {plan.durationDays}d
                      </Text>
                    </View>
                    <View style={styles.curatedBadge}>
                      <Text style={styles.curatedText}>Curated</Text>
                    </View>
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.description && (
                    <Text style={styles.planDesc} numberOfLines={2}>
                      {plan.description}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* ═══ EDITORIAL FOOTER ═══════════════════════ */}
      <Animated.View style={[styles.footer, anim(4)]}>
        <View style={styles.footerRule} />
        <Text style={styles.footerText}>
          Every place passes a multi-factor quality analysis.{'\n'}
          If it{'\u2019'}s not genuinely great, it doesn{'\u2019'}t make the cut.
        </Text>
        <View style={styles.footerStats}>
          <View style={styles.footerStat}>
            <Text style={styles.statNum}>Top 5%</Text>
            <Text style={styles.statDesc}>Acceptance</Text>
          </View>
          <View style={styles.footerStatDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.statNum}>0 Ads</Text>
            <Text style={styles.statDesc}>Unbiased</Text>
          </View>
          <View style={styles.footerStatDivider} />
          <View style={styles.footerStat}>
            <Text style={styles.statNum}>Local</Text>
            <Text style={styles.statDesc}>Verified</Text>
          </View>
        </View>
      </Animated.View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES — Editorial Travel Journal aesthetic
   ═══════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    paddingBottom: 24,
  },

  /* ── HEADER ────────────────────────────────────── */
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 64,
    paddingBottom: 6,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 28,
    height: 34,
  },
  headerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sunsetOrange,
    marginHorizontal: 10,
  },
  headerLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 3,
  },
  heroTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 42,
    color: colors.deepOcean,
    letterSpacing: -0.5,
    lineHeight: 48,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  taglineRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.deepOcean + '18',
  },
  tagline: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginHorizontal: 14,
    textTransform: 'uppercase',
  },

  /* ── CTA CARD ──────────────────────────────────── */
  ctaOuter: {
    paddingHorizontal: spacing.lg,
    marginTop: 22,
  },
  ctaCard: {
    borderRadius: 20,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  ctaTop: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  ctaBadge: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ctaBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  ctaTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 34,
    marginBottom: 8,
  },
  ctaSub: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 21,
    marginBottom: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.electricBlue,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
    marginRight: 8,
  },
  ctaArrow: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  ctaCornerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 80,
    height: 80,
    borderBottomLeftRadius: 80,
    backgroundColor: colors.sunsetOrange + '12',
  },

  /* ── SECTIONS ──────────────────────────────────── */
  section: {
    marginTop: 36,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
    letterSpacing: 2.5,
    marginHorizontal: spacing.lg,
    marginBottom: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  sectionHeading: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: colors.deepOcean,
    paddingHorizontal: spacing.lg,
    marginBottom: 18,
  },
  seeAllPill: {
    borderWidth: 1,
    borderColor: colors.electricBlue + '40',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  seeAllText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.electricBlue,
  },

  /* ── CATEGORIES ────────────────────────────────── */
  catScroll: {
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  catPill: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  catAccentBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  catEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  catName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textMain,
    letterSpacing: 0.3,
  },

  /* ── FEATURED PLANS ────────────────────────────── */
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: 18,
  },
  planScroll: {
    paddingHorizontal: spacing.lg,
    gap: 14,
  },
  planCard: {
    width: SCREEN_WIDTH * 0.78,
    height: 260,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
    position: 'relative',
  },
  planAccentTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.sunsetOrange,
    zIndex: 10,
  },
  planImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  planOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 22,
  },
  planBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  daysBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  daysText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  curatedBadge: {
    backgroundColor: colors.sunsetOrange + 'DD',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  curatedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planName: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  planDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },

  /* ── SKELETON ──────────────────────────────────── */
  skeleton: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: colors.borderColor,
  },

  /* ── EDITORIAL FOOTER ──────────────────────────── */
  footer: {
    marginTop: 40,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  footerRule: {
    width: 40,
    height: 2,
    backgroundColor: colors.sunsetOrange,
    borderRadius: 1,
    marginBottom: 18,
  },
  footerText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  footerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderColor,
  },
  statNum: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    marginBottom: 2,
  },
  statDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
