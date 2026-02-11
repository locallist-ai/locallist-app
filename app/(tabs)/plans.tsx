import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlanCard } from '../../components/PlanCard';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../lib/auth';
import { colors, spacing, fonts } from '../../lib/theme';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  imageUrl: string | null;
  type: string;
  isShowcase: boolean;
}

export default function PlansScreen() {
  const router = useRouter();
  const { isPro, isAuthenticated } = useAuth();
  const { data, isLoading } = useApi<{ plans: Plan[] }>('/plans');

  const plans = data?.plans ?? [];
  const curated = plans.filter((p) => p.isShowcase);
  const userPlans = plans.filter((p) => !p.isShowcase);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Plans</Text>
        <View style={styles.titleRule} />
      </View>

      {/* User plans */}
      {userPlans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MY PLANS</Text>
          {userPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              id={plan.id}
              name={plan.name}
              description={plan.description}
              durationDays={plan.durationDays}
              imageUrl={plan.imageUrl}
              type={plan.type}
              isShowcase={plan.isShowcase}
            />
          ))}
        </View>
      )}

      {/* ── Upgrade Nudge (non-Pro) ──────── */}
      {!isPro && (
        <View style={styles.nudgeBanner}>
          <LinearGradient
            colors={[colors.deepOcean, '#1e3a5f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nudgeCard}
          >
            <View style={styles.nudgeContent}>
              <Text style={styles.nudgeIcon}>{'\u{1F512}'}</Text>
              <View style={styles.nudgeText}>
                <Text style={styles.nudgeTitle}>
                  {isAuthenticated ? 'Upgrade to Pro' : 'Sign up for free'}
                </Text>
                <Text style={styles.nudgeDesc}>
                  {isAuthenticated
                    ? 'Follow Mode, 50 plans/day, full catalog access'
                    : 'Save plans, build more, unlock premium features'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => isAuthenticated ? router.push('/(tabs)/account') : router.push('/(auth)/login')}
            >
              <View style={styles.nudgeBtn}>
                <Text style={styles.nudgeBtnText}>
                  {isAuthenticated ? 'Go Pro' : 'Sign Up'}
                </Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Curated plans */}
      {curated.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CURATED BY LOCALS</Text>
          {curated.map((plan) => (
            <PlanCard
              key={plan.id}
              id={plan.id}
              name={plan.name}
              description={plan.description}
              durationDays={plan.durationDays}
              imageUrl={plan.imageUrl}
              type={plan.type}
              isShowcase={plan.isShowcase}
            />
          ))}
        </View>
      )}

      {plans.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{'\u{1F5FA}'}</Text>
          <Text style={styles.emptyTitle}>No plans yet</Text>
          <Text style={styles.emptySubtitle}>
            Build your first plan with the AI Builder or browse our curated picks.
          </Text>
        </View>
      )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Header ─────────────────────────────
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    color: colors.deepOcean,
    lineHeight: 38,
    marginBottom: 10,
  },
  titleRule: {
    width: 36,
    height: 2,
    backgroundColor: colors.sunsetOrange,
    borderRadius: 1,
  },

  // ── Sections ───────────────────────────
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
    letterSpacing: 2.5,
    marginBottom: 16,
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // ── Upgrade Nudge ─────────────────────
  nudgeBanner: {
    paddingHorizontal: spacing.lg,
    marginTop: 24,
  },
  nudgeCard: {
    borderRadius: 16,
    padding: 18,
  },
  nudgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  nudgeIcon: {
    fontSize: 28,
  },
  nudgeText: {
    flex: 1,
  },
  nudgeTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  nudgeDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
  },
  nudgeBtn: {
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  nudgeBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── Empty State ────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
