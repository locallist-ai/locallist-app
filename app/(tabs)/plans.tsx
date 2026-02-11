import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { PlanCard } from '../../components/PlanCard';
import { useApi } from '../../hooks/useApi';
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
