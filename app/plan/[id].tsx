import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PaywallModal } from '../../components/PaywallModal';
import { SignupPromptModal } from '../../components/SignupPromptModal';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../lib/auth';
import { colors, spacing, fonts } from '../../lib/theme';

interface Place {
  id: string;
  name: string;
  category: string;
  neighborhood: string | null;
  whyThisPlace: string;
  priceRange: string | null;
}

interface Stop {
  id: string;
  orderIndex: number;
  timeBlock: string;
  suggestedArrival: string | null;
  suggestedDurationMin: number | null;
  travelFromPrevious: {
    distance_km: number;
    duration_min: number;
    mode: string;
  } | null;
  place: Place;
}

interface Day {
  dayNumber: number;
  stops: Stop[];
}

interface PlanDetail {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  type: string;
  isShowcase: boolean;
  days: Day[];
}

const CATEGORY_ICONS: Record<string, string> = {
  food: '\u{1F37D}',
  coffee: '\u2615',
  culture: '\u{1F3A8}',
  nightlife: '\u{1F378}',
  outdoors: '\u{1F3D6}',
  wellness: '\u{1F9D8}',
};

const TIME_COLORS: Record<string, string> = {
  morning: '#f59e0b',
  afternoon: '#3b82f6',
  evening: '#8b5cf6',
};

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isPro } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const { data, isLoading } = useApi<PlanDetail>(`/plans/${id}`);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>{'\u{1F50D}'}</Text>
        <Text style={styles.emptyTitle}>Plan not found</Text>
      </View>
    );
  }

  const totalStops = data.days?.reduce((sum, d) => sum + d.stops.length, 0) ?? 0;

  const handleFollowMode = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    if (!isPro) {
      setShowPaywall(true);
      return;
    }
    router.push(`/follow/${data.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ HERO HEADER ═══════════════════════ */}
      <LinearGradient
        colors={[colors.deepOcean, '#1e3a5f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroCornerAccent} />
        <View style={styles.heroBadges}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {data.durationDays} {data.durationDays === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{totalStops} stops</Text>
          </View>
          {data.isShowcase && (
            <View style={styles.curatedBadge}>
              <Text style={styles.curatedBadgeText}>Curated</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroTitle}>{data.name}</Text>
        {data.description && (
          <Text style={styles.heroDescription}>{data.description}</Text>
        )}
      </LinearGradient>

      {/* ═══ FOLLOW MODE CTA ══════════════════ */}
      {isPro ? (
        <View style={styles.ctaSection}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleFollowMode}>
            <LinearGradient
              colors={[colors.electricBlue, '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.followBtn}
            >
              <Text style={styles.followBtnText}>Follow This Plan</Text>
              <Text style={styles.followBtnIcon}>{'\u2192'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.followHint}>
            Step-by-step navigation with directions to each spot
          </Text>
        </View>
      ) : (
        <View style={styles.followUpsell}>
          <LinearGradient
            colors={[colors.deepOcean, '#1e3a5f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.followUpsellCard}
          >
            <View style={styles.followUpsellCorner} />
            <View style={styles.followUpsellBadge}>
              <Text style={styles.followUpsellBadgeText}>PRO FEATURE</Text>
            </View>
            <Text style={styles.followUpsellTitle}>Follow Mode</Text>
            <Text style={styles.followUpsellDesc}>
              Navigate this plan stop-by-stop with real-time guidance. See where you are, what{'\u2019'}s next, and get directions — hands-free.
            </Text>

            {/* Mini preview showing first 3 stops */}
            <View style={styles.followPreviewList}>
              {data.days?.[0]?.stops.slice(0, 3).map((stop, i) => (
                <View key={stop.id} style={styles.followPreviewItem}>
                  <View style={[styles.followPreviewDot, i === 0 && styles.followPreviewDotActive]} />
                  <View style={styles.followPreviewInfo}>
                    <Text style={[styles.followPreviewName, i === 0 && styles.followPreviewNameActive]}>
                      {stop.place.name}
                    </Text>
                    <Text style={styles.followPreviewMeta}>
                      {stop.suggestedArrival ?? stop.timeBlock} {'\u00B7'} {stop.place.category}
                    </Text>
                  </View>
                  {i === 0 && (
                    <View style={styles.followPreviewNowBadge}>
                      <Text style={styles.followPreviewNowText}>START</Text>
                    </View>
                  )}
                </View>
              ))}
              {(data.days?.[0]?.stops.length ?? 0) > 3 && (
                <Text style={styles.followPreviewMore}>
                  +{(data.days?.[0]?.stops.length ?? 3) - 3} more stops...
                </Text>
              )}
            </View>

            <View style={styles.followUpsellFeatures}>
              <Text style={styles.followUpsellFeature}>{'\u2713'} Turn-by-turn navigation</Text>
              <Text style={styles.followUpsellFeature}>{'\u2713'} Real-time progress tracking</Text>
              <Text style={styles.followUpsellFeature}>{'\u2713'} Skip, pause, resume anytime</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => isAuthenticated ? setShowPaywall(true) : setShowSignup(true)}
            >
              <View style={styles.followUpsellBtn}>
                <Text style={styles.followUpsellBtnText}>
                  {isAuthenticated ? 'Unlock Follow Mode' : 'Sign Up to Unlock'}
                </Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* ═══ DAY-BY-DAY ═══════════════════════ */}
      {data.days?.map((day) => (
        <View key={day.dayNumber} style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayLabel}>DAY {day.dayNumber}</Text>
            <View style={styles.dayRule} />
            <Text style={styles.dayCount}>{day.stops.length} stops</Text>
          </View>

          {day.stops.map((stop, index) => (
            <View key={stop.id}>
              {/* Travel connector */}
              {stop.travelFromPrevious && index > 0 && (
                <View style={styles.travelConnector}>
                  <View style={styles.travelLine} />
                  <View style={styles.travelPill}>
                    <Text style={styles.travelText}>
                      {stop.travelFromPrevious.mode === 'walk' ? '\u{1F6B6}' : '\u{1F697}'}{' '}
                      {stop.travelFromPrevious.duration_min} min
                    </Text>
                  </View>
                  <View style={styles.travelLine} />
                </View>
              )}

              {/* Stop card */}
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push(`/place/${stop.place.id}`)}
                style={styles.stopOuter}
              >
                <View style={styles.stopCard}>
                  <View
                    style={[
                      styles.stopAccent,
                      { backgroundColor: TIME_COLORS[stop.timeBlock] ?? colors.electricBlue },
                    ]}
                  />
                  <View style={styles.stopHeader}>
                    <View style={styles.stopTimeRow}>
                      {stop.suggestedArrival && (
                        <Text
                          style={[
                            styles.stopTime,
                            { color: TIME_COLORS[stop.timeBlock] ?? colors.electricBlue },
                          ]}
                        >
                          {stop.suggestedArrival}
                        </Text>
                      )}
                      {stop.suggestedDurationMin && (
                        <Text style={styles.stopDuration}>
                          {stop.suggestedDurationMin} min
                        </Text>
                      )}
                    </View>
                    <View style={styles.stopCategoryBadge}>
                      <Text style={styles.stopCategoryIcon}>
                        {CATEGORY_ICONS[stop.place.category] ?? '\u{1F4CD}'}
                      </Text>
                      <Text style={styles.stopCategoryText}>{stop.place.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.stopName}>{stop.place.name}</Text>
                  <View style={styles.stopMeta}>
                    {stop.place.neighborhood && (
                      <Text style={styles.stopNeighborhood}>{stop.place.neighborhood}</Text>
                    )}
                    {stop.place.priceRange && (
                      <Text style={styles.stopPrice}>{stop.place.priceRange}</Text>
                    )}
                  </View>
                  <Text style={styles.stopWhy}>{stop.place.whyThisPlace}</Text>
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={() => {
          setShowPaywall(false);
        }}
        trigger="follow_mode"
      />
      <SignupPromptModal
        visible={showSignup}
        onClose={() => setShowSignup(false)}
        onSignUp={() => {
          setShowSignup(false);
          router.push('/(auth)/login');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
  },

  // ── Hero ───────────────────────────────
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: 28,
    paddingBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCornerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    borderBottomLeftRadius: 100,
    backgroundColor: colors.sunsetOrange + '12',
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  curatedBadge: {
    backgroundColor: colors.sunsetOrange + 'DD',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  curatedBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 8,
  },
  heroDescription: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },

  // ── Follow CTA ─────────────────────────
  ctaSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    paddingBottom: 8,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  followBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  followBtnIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  followHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // ── Day Sections ───────────────────────
  daySection: {
    paddingHorizontal: spacing.lg,
    marginTop: 32,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  dayLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    letterSpacing: 2,
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dayRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderColor,
  },
  dayCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Travel Connector ───────────────────
  travelConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  travelLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderColor,
  },
  travelPill: {
    backgroundColor: colors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    marginHorizontal: 8,
  },
  travelText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // ── Stop Card ──────────────────────────
  stopOuter: {
    marginBottom: 4,
  },
  stopCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  stopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stopTime: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  stopDuration: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  stopCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMain,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  stopCategoryIcon: {
    fontSize: 12,
  },
  stopCategoryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  stopName: {
    fontFamily: fonts.headingBold,
    fontSize: 19,
    color: colors.deepOcean,
    lineHeight: 24,
    marginBottom: 4,
  },
  stopMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  stopNeighborhood: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  stopPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  stopWhy: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMain,
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // ── Follow Mode Upsell ────────────────
  followUpsell: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    paddingBottom: 8,
  },
  followUpsellCard: {
    borderRadius: 20,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  followUpsellCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 80,
    height: 80,
    borderBottomLeftRadius: 80,
    backgroundColor: colors.sunsetOrange + '18',
  },
  followUpsellBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 14,
  },
  followUpsellBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  followUpsellTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 10,
  },
  followUpsellDesc: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 21,
    marginBottom: 18,
  },
  followPreviewList: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  followPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  followPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
  },
  followPreviewDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.sunsetOrange,
  },
  followPreviewInfo: {
    flex: 1,
  },
  followPreviewName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 1,
  },
  followPreviewNameActive: {
    fontFamily: fonts.bodySemiBold,
    color: '#FFFFFF',
  },
  followPreviewMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  followPreviewNowBadge: {
    backgroundColor: colors.sunsetOrange + '30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  followPreviewNowText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    color: colors.sunsetOrange,
    letterSpacing: 1,
  },
  followPreviewMore: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingTop: 6,
  },
  followUpsellFeatures: {
    marginBottom: 18,
    gap: 6,
  },
  followUpsellFeature: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  followUpsellBtn: {
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  followUpsellBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
