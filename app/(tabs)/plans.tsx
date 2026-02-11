import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { PlanCard } from '../../components/PlanCard';
import { useApi } from '../../hooks/useApi';
import { colors, spacing, typography } from '../../lib/theme';

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
  const { data, isLoading, refetch } = useApi<{ plans: Plan[] }>('/plans');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
      </View>
    );
  }

  return (
    <FlatList
      data={data?.plans ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      style={styles.container}
      onRefresh={refetch}
      refreshing={isLoading}
      renderItem={({ item }) => (
        <PlanCard
          id={item.id}
          name={item.name}
          description={item.description}
          durationDays={item.durationDays}
          imageUrl={item.imageUrl}
          type={item.type}
          isShowcase={item.isShowcase}
        />
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No plans yet. Check back soon!</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  list: {
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
