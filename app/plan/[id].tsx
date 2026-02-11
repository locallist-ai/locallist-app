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
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PaywallModal } from '../../components/PaywallModal';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../lib/auth';
import { colors, spacing, typography, borderRadius } from '../../lib/theme';

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

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isPro } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);
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
        <Text style={styles.errorText}>Plan not found</Text>
      </View>
    );
  }

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.planName}>{data.name}</Text>
      {data.description && (
        <Text style={styles.description}>{data.description}</Text>
      )}

      <View style={styles.meta}>
        <Badge
          text={`${data.durationDays} ${data.durationDays === 1 ? 'day' : 'days'}`}
          variant="blue"
        />
        <Badge text={data.type} variant="default" />
      </View>

      {/* Follow Mode CTA */}
      <Button
        title="Follow This Plan"
        onPress={handleFollowMode}
        variant="primary"
        size="lg"
        style={styles.followButton}
      />

      {/* Day-by-day view */}
      {data.days?.map((day) => (
        <View key={day.dayNumber} style={styles.daySection}>
          <Text style={styles.dayTitle}>Day {day.dayNumber}</Text>
          {day.stops.map((stop, index) => (
            <View key={stop.id}>
              {/* Travel info from previous */}
              {stop.travelFromPrevious && index > 0 && (
                <View style={styles.travelInfo}>
                  <Text style={styles.travelText}>
                    {stop.travelFromPrevious.mode === 'walk' ? '\u{1F6B6}' : '\u{1F697}'}{' '}
                    {stop.travelFromPrevious.distance_km} km{' '}
                    ({stop.travelFromPrevious.duration_min} min)
                  </Text>
                </View>
              )}

              {/* Stop card */}
              <TouchableOpacity
                onPress={() => router.push(`/place/${stop.place.id}`)}
                activeOpacity={0.7}
              >
                <Card style={styles.stopCard}>
                  <View style={styles.stopHeader}>
                    <Badge text={stop.timeBlock} variant="blue" />
                    {stop.suggestedArrival && (
                      <Text style={styles.arrival}>{stop.suggestedArrival}</Text>
                    )}
                    {stop.suggestedDurationMin && (
                      <Text style={styles.duration}>
                        {stop.suggestedDurationMin}min
                      </Text>
                    )}
                  </View>
                  <Text style={styles.stopName}>{stop.place.name}</Text>
                  <Text style={styles.stopNeighborhood}>
                    {stop.place.neighborhood} {stop.place.priceRange && `\u00B7 ${stop.place.priceRange}`}
                  </Text>
                  <Text style={styles.stopWhy} numberOfLines={2}>
                    {stop.place.whyThisPlace}
                  </Text>
                </Card>
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
          // TODO: trigger RevenueCat purchase
        }}
        trigger="follow_mode"
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  followButton: {
    marginBottom: spacing.xl,
    width: '100%',
  },
  daySection: {
    marginBottom: spacing.lg,
  },
  dayTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  travelInfo: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  travelText: {
    ...typography.caption,
  },
  stopCard: {
    marginBottom: spacing.xs,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  arrival: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  duration: {
    ...typography.caption,
  },
  stopName: {
    ...typography.h3,
    fontSize: 18,
    marginBottom: 2,
  },
  stopNeighborhood: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  stopWhy: {
    ...typography.bodySmall,
    fontStyle: 'italic',
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
