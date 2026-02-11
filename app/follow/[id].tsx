import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { colors, spacing, typography, borderRadius } from '../../lib/theme';

interface Place {
  id: string;
  name: string;
  category: string;
  neighborhood: string | null;
  whyThisPlace: string;
  latitude: string | null;
  longitude: string | null;
}

interface Stop {
  stop: {
    id: string;
    timeBlock: string;
    suggestedDurationMin: number | null;
  };
  place: Place;
}

interface FollowData {
  session: {
    id: string;
    status: string;
    currentDayIndex: number;
    currentStopIndex: number;
  };
  currentStop: Stop | null;
  nextStop: Stop | null;
  totalStopsToday: number;
  progress: {
    currentDay: number;
    currentStopInDay: number;
    totalStopsToday: number;
  };
}

export default function FollowModeScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [followData, setFollowData] = useState<FollowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  const startOrGetSession = async () => {
    setIsLoading(true);

    // Check for existing active session
    let { data } = await api<FollowData>('/follow/active');

    if (!data?.session) {
      // Start new session
      const startResult = await api<any>('/follow/start', {
        method: 'POST',
        body: { planId },
      });

      if (startResult.data) {
        // Re-fetch active session with full data
        const activeResult = await api<FollowData>('/follow/active');
        data = activeResult.data;
      }
    }

    setFollowData(data);
    setIsLoading(false);
  };

  useEffect(() => {
    startOrGetSession();
  }, [planId]);

  const handleNext = async () => {
    if (!followData?.session) return;
    setIsActing(true);

    await api(`/follow/${followData.session.id}/next`, { method: 'PATCH' });
    const { data } = await api<FollowData>('/follow/active');

    if (!data?.session || data.session.status !== 'active') {
      // Session completed
      Alert.alert('Plan Complete!', 'You finished the plan. Nice work!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      setFollowData(data);
    }
    setIsActing(false);
  };

  const handleSkip = async () => {
    if (!followData?.session) return;
    setIsActing(true);

    await api(`/follow/${followData.session.id}/skip`, { method: 'PATCH' });
    const { data } = await api<FollowData>('/follow/active');
    setFollowData(data);
    setIsActing(false);
  };

  const handleComplete = async () => {
    if (!followData?.session) return;

    Alert.alert('Finish Plan?', 'Mark this plan as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          await api(`/follow/${followData.session.id}/complete`, {
            method: 'PATCH',
          });
          router.back();
        },
      },
    ]);
  };

  const navigateToPlace = (place: Place) => {
    if (!place.latitude || !place.longitude) return;
    const label = encodeURIComponent(place.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${place.latitude},${place.longitude}`,
      android: `geo:${place.latitude},${place.longitude}?q=${label}`,
      default: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={styles.loadingText}>Starting Follow Mode...</Text>
      </View>
    );
  }

  if (!followData?.currentStop) {
    return (
      <View style={styles.center}>
        <Text style={styles.completedText}>No more stops!</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="primary"
        />
      </View>
    );
  }

  const { currentStop, nextStop, progress } = followData;

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  progress.totalStopsToday > 0
                    ? ((progress.currentStopInDay! + 1) / progress.totalStopsToday) * 100
                    : 0
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Day {progress.currentDay} \u2022 Stop {progress.currentStopInDay! + 1}/{progress.totalStopsToday}
        </Text>
      </View>

      {/* Current Stop */}
      <Card style={styles.currentCard}>
        <Badge text="Now" variant="orange" />
        <Text style={styles.currentName}>{currentStop.place.name}</Text>
        <Text style={styles.currentNeighborhood}>
          {currentStop.place.neighborhood}
        </Text>
        <Text style={styles.currentWhy}>{currentStop.place.whyThisPlace}</Text>

        {currentStop.stop.suggestedDurationMin && (
          <Text style={styles.durationHint}>
            Spend about {currentStop.stop.suggestedDurationMin} min here
          </Text>
        )}

        <Button
          title="Navigate"
          onPress={() => navigateToPlace(currentStop.place)}
          variant="primary"
          size="lg"
          style={styles.navigateButton}
        />
      </Card>

      {/* Next Stop Preview */}
      {nextStop && (
        <Card style={styles.nextCard}>
          <Text style={styles.nextLabel}>Up Next</Text>
          <Text style={styles.nextName}>{nextStop.place.name}</Text>
          <Text style={styles.nextNeighborhood}>
            {nextStop.place.neighborhood}
          </Text>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Done"
          onPress={handleNext}
          variant="primary"
          size="lg"
          loading={isActing}
          style={styles.actionButton}
        />
        <Button
          title="Skip"
          onPress={handleSkip}
          variant="outline"
          size="lg"
          loading={isActing}
          style={styles.actionButton}
        />
        <Button
          title="End"
          onPress={handleComplete}
          variant="ghost"
          size="sm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  completedText: {
    ...typography.h2,
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.borderColor,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.electricBlue,
    borderRadius: 3,
  },
  progressText: {
    ...typography.caption,
    textAlign: 'center',
  },
  currentCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  currentName: {
    ...typography.h1,
    fontSize: 26,
  },
  currentNeighborhood: {
    ...typography.bodySmall,
  },
  currentWhy: {
    ...typography.body,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  durationHint: {
    ...typography.caption,
    color: colors.electricBlue,
  },
  navigateButton: {
    width: '100%',
    marginTop: spacing.sm,
  },
  nextCard: {
    marginBottom: spacing.lg,
    opacity: 0.7,
  },
  nextLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextName: {
    ...typography.h3,
  },
  nextNeighborhood: {
    ...typography.caption,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
  },
  actionButton: {
    flex: 1,
  },
});
