import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { getMockFollowData } from '../../lib/mock-data';
import { colors, spacing, fonts } from '../../lib/theme';

const USE_MOCK = __DEV__;

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

const CATEGORY_ICONS: Record<string, string> = {
  food: '\u{1F37D}',
  coffee: '\u2615',
  culture: '\u{1F3A8}',
  nightlife: '\u{1F378}',
  outdoors: '\u{1F3D6}',
  wellness: '\u{1F9D8}',
};

export default function FollowModeScreen() {
  const { id: planId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [followData, setFollowData] = useState<FollowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [mockStopIndex, setMockStopIndex] = useState(0);

  const startOrGetSession = async () => {
    setIsLoading(true);

    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 600));
      setFollowData(getMockFollowData(planId!, 0) as any);
      setMockStopIndex(0);
      setIsLoading(false);
      return;
    }

    let { data } = await api<FollowData>('/follow/active');

    if (!data?.session) {
      const startResult = await api<any>('/follow/start', {
        method: 'POST',
        body: { planId },
      });

      if (startResult.data) {
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

    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      const nextIdx = mockStopIndex + 1;
      const nextData = getMockFollowData(planId!, nextIdx) as any;
      if (!nextData || nextData.session.status === 'completed') {
        Alert.alert('Plan Complete!', 'You finished the plan. Nice work!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        setMockStopIndex(nextIdx);
        setFollowData(nextData);
      }
      setIsActing(false);
      return;
    }

    await api(`/follow/${followData.session.id}/next`, { method: 'PATCH' });
    const { data } = await api<FollowData>('/follow/active');

    if (!data?.session || data.session.status !== 'active') {
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

    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      const nextIdx = mockStopIndex + 1;
      const nextData = getMockFollowData(planId!, nextIdx) as any;
      if (nextData) {
        setMockStopIndex(nextIdx);
        setFollowData(nextData);
      }
      setIsActing(false);
      return;
    }

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
          if (USE_MOCK) {
            router.back();
            return;
          }
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

  // ─── Loading ───────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={styles.loadingTitle}>Starting Follow Mode</Text>
        <Text style={styles.loadingSubtitle}>Preparing your itinerary...</Text>
      </View>
    );
  }

  // ─── No more stops ─────────────────────────
  if (!followData?.currentStop) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.completedIcon}>{'\u{1F389}'}</Text>
        <Text style={styles.completedTitle}>All done!</Text>
        <Text style={styles.completedSubtitle}>You've visited every stop.</Text>
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.back()}>
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Back to Plan</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const { currentStop, nextStop, progress } = followData;
  const progressPct =
    progress.totalStopsToday > 0
      ? ((progress.currentStopInDay + 1) / progress.totalStopsToday) * 100
      : 0;

  return (
    <View style={styles.container}>
      {/* ═══ PROGRESS ═══════════════════════════ */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            Day {progress.currentDay}
          </Text>
          <Text style={styles.progressCount}>
            {progress.currentStopInDay + 1} of {progress.totalStopsToday}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progressPct}%` }]}
          />
        </View>
      </View>

      {/* ═══ CURRENT STOP ═════════════════════ */}
      <View style={styles.currentCard}>
        <View style={styles.nowBadge}>
          <View style={styles.nowDot} />
          <Text style={styles.nowText}>NOW</Text>
        </View>

        <Text style={styles.currentName}>{currentStop.place.name}</Text>

        <View style={styles.currentMeta}>
          {currentStop.place.neighborhood && (
            <Text style={styles.currentNeighborhood}>{currentStop.place.neighborhood}</Text>
          )}
          <View style={styles.currentCategoryBadge}>
            <Text style={styles.currentCategoryIcon}>
              {CATEGORY_ICONS[currentStop.place.category] ?? '\u{1F4CD}'}
            </Text>
            <Text style={styles.currentCategoryText}>{currentStop.place.category}</Text>
          </View>
        </View>

        <Text style={styles.currentWhy}>
          {'\u201C'}{currentStop.place.whyThisPlace}{'\u201D'}
        </Text>

        {currentStop.stop.suggestedDurationMin && (
          <View style={styles.durationRow}>
            <Text style={styles.durationIcon}>{'\u23F1'}</Text>
            <Text style={styles.durationText}>
              Spend about {currentStop.stop.suggestedDurationMin} min here
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigateToPlace(currentStop.place)}
          style={styles.navigateOuter}
        >
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.navigateBtn}
          >
            <Text style={styles.navigateBtnText}>Navigate</Text>
            <Text style={styles.navigateBtnIcon}>{'\u{1F4CD}'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ═══ NEXT STOP PREVIEW ════════════════ */}
      {nextStop && (
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>UP NEXT</Text>
          <Text style={styles.nextName}>{nextStop.place.name}</Text>
          {nextStop.place.neighborhood && (
            <Text style={styles.nextNeighborhood}>{nextStop.place.neighborhood}</Text>
          )}
        </View>
      )}

      {/* ═══ ACTIONS ══════════════════════════ */}
      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleNext}
          disabled={isActing}
          style={[styles.actionDone, isActing && styles.actionDisabled]}
        >
          <LinearGradient
            colors={[colors.deepOcean, '#1a2744']}
            style={styles.actionDoneGradient}
          >
            <Text style={styles.actionDoneText}>
              {isActing ? 'Moving...' : 'Done \u2713'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSkip}
          disabled={isActing}
          style={[styles.actionSkip, isActing && styles.actionDisabled]}
        >
          <Text style={styles.actionSkipText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleComplete}
          style={styles.actionEnd}
        >
          <Text style={styles.actionEndText}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
  },

  // ── Loading ────────────────────────────
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 8,
  },
  loadingTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
    marginTop: 16,
  },
  loadingSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // ── Completed ──────────────────────────
  completedIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  completedTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.deepOcean,
  },
  completedSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  backBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },

  // ── Progress ───────────────────────────
  progressSection: {
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    letterSpacing: 2,
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  progressCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.borderColor,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── Current Stop Card ──────────────────
  currentCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 14,
  },
  nowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sunsetOrange,
  },
  nowText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
    letterSpacing: 2,
  },
  currentName: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.deepOcean,
    lineHeight: 32,
    marginBottom: 6,
  },
  currentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  currentNeighborhood: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  currentCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMain,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  currentCategoryIcon: {
    fontSize: 12,
  },
  currentCategoryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  currentWhy: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.textMain,
    fontStyle: 'italic',
    lineHeight: 23,
    marginBottom: 14,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  durationIcon: {
    fontSize: 14,
  },
  durationText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.electricBlue,
  },
  navigateOuter: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  navigateBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  navigateBtnIcon: {
    fontSize: 14,
  },

  // ── Next Stop ──────────────────────────
  nextCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    marginBottom: 14,
  },
  nextLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  nextName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.deepOcean,
    marginBottom: 2,
  },
  nextNeighborhood: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Actions ────────────────────────────
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingBottom: 16,
  },
  actionDone: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionDoneGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionDoneText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  actionSkip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  actionSkipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textMain,
  },
  actionEnd: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEndText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
