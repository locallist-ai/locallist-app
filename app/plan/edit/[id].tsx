import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors, fonts, spacing, borderRadius } from '../../../lib/theme';
import { usePlanEditor } from '../../../lib/use-plan-editor';
import { DaySection } from '../../../components/plan-editor/DaySection';
import { MoveToDay } from '../../../components/plan-editor/MoveToDay';
import { PlaceSearchModal } from '../../../components/plan-editor/PlaceSearchModal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function PlanEditScreen() {
  const { id, planName, planCity, planDays } = useLocalSearchParams<{
    id: string;
    planName?: string;
    planCity?: string;
    planDays?: string;
  }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const newPlanConfig = id === 'new' && planName && planCity
    ? { name: planName, city: planCity, durationDays: Number(planDays) || 2 }
    : undefined;

  const { plan, days, isDirty, isSaving, loading, error, dispatch, save } = usePlanEditor(id!, newPlanConfig);

  // Move to day state
  const [moveState, setMoveState] = useState<{
    visible: boolean;
    fromDay: number;
    stopIndex: number;
  }>({ visible: false, fromDay: 0, stopIndex: 0 });

  // Add place state
  const [addState, setAddState] = useState<{
    visible: boolean;
    dayNumber: number;
  }>({ visible: false, dayNumber: 1 });

  // Unsaved changes confirm modal
  const [discardVisible, setDiscardVisible] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingAction = useRef<any>(null);

  const handleSave = useCallback(async () => {
    const result = await save();
    if (result.success) {
      router.back();
    } else {
      setSaveError(result.error ?? 'Failed to save');
    }
  }, [save]);

  // Configure native header with Save button
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleSave}
          disabled={!isDirty || isSaving}
          style={[s.saveBtn, (!isDirty || isSaving) && s.saveBtnDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, isDirty, isSaving, handleSave]);

  // Unsaved changes guard on back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;

      e.preventDefault();
      pendingAction.current = e.data.action;
      setDiscardVisible(true);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.sunsetOrange} />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={s.errorText}>{error ?? 'Plan not found'}</Text>
        <TouchableOpacity style={s.backBtnErr} onPress={() => router.back()} accessibilityRole="button">
          <Text style={s.backBtnErrText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalDays = plan.durationDays ?? Math.max(...days.map((d) => d.dayNumber), 1);
  const totalStops = days.reduce((acc, d) => acc + d.stops.length, 0);

  return (
    <GestureHandlerRootView style={s.root}>
      {/* Meta bar */}
      <View style={s.metaBar}>
        <Ionicons name="location" size={14} color={colors.sunsetOrange} />
        <Text style={s.metaText}>
          {plan.city} · {totalDays} {totalDays === 1 ? 'day' : 'days'} · {totalStops} {totalStops === 1 ? 'stop' : 'stops'}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty state hint */}
        {totalStops === 0 && (
          <Animated.View entering={FadeInDown.duration(500).springify().damping(16)} style={s.emptyHint}>
            <View style={s.emptyIcon}>
              <Ionicons name="compass-outline" size={32} color={colors.sunsetOrange} />
            </View>
            <Text style={s.emptyTitle}>Your plan is empty</Text>
            <Text style={s.emptyBody}>
              Tap "+ Add a stop" on any day to start building your itinerary.
            </Text>
          </Animated.View>
        )}

        {days.map((day, dayIdx) => (
          <Animated.View
            key={day.dayNumber}
            entering={FadeInDown.delay(dayIdx * 80).duration(400).springify().damping(16)}
          >
            <DaySection
              dayNumber={day.dayNumber}
              stops={day.stops}
              onReorder={(from, to) =>
                dispatch({ type: 'REORDER', dayNumber: day.dayNumber, from, to })
              }
              onDeleteStop={(stopIndex) =>
                dispatch({ type: 'DELETE_STOP', dayNumber: day.dayNumber, stopIndex })
              }
              onMoveStop={(stopIndex) =>
                setMoveState({ visible: true, fromDay: day.dayNumber, stopIndex })
              }
              onAddPress={() =>
                setAddState({ visible: true, dayNumber: day.dayNumber })
              }
            />
          </Animated.View>
        ))}

        {/* Dirty indicator */}
        {isDirty && (
          <Animated.View entering={FadeInDown.duration(300)} style={s.dirtyBar}>
            <Ionicons name="alert-circle" size={14} color={colors.sunsetOrange} />
            <Text style={s.dirtyText}>Unsaved changes</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Move to Day sheet */}
      <MoveToDay
        visible={moveState.visible}
        currentDay={moveState.fromDay}
        totalDays={totalDays}
        onSelect={(toDay) => {
          dispatch({
            type: 'MOVE_TO_DAY',
            fromDay: moveState.fromDay,
            stopIndex: moveState.stopIndex,
            toDay,
          });
          setMoveState({ ...moveState, visible: false });
        }}
        onClose={() => setMoveState({ ...moveState, visible: false })}
      />

      {/* Place search modal */}
      <PlaceSearchModal
        visible={addState.visible}
        city={plan.city}
        onSelect={(place) => {
          dispatch({ type: 'ADD_STOP', dayNumber: addState.dayNumber, place });
          setAddState({ ...addState, visible: false });
        }}
        onClose={() => setAddState({ ...addState, visible: false })}
      />

      {/* Save error */}
      <ConfirmModal
        visible={!!saveError}
        icon="alert-circle-outline"
        iconColor={colors.error}
        title="Save Failed"
        body={saveError ?? ''}
        confirmLabel="OK"
        onCancel={() => setSaveError(null)}
        onConfirm={() => setSaveError(null)}
      />

      {/* Discard changes confirm */}
      <ConfirmModal
        visible={discardVisible}
        icon="warning-outline"
        iconColor={colors.sunsetOrange}
        title="Unsaved Changes"
        body="You have unsaved changes. Are you sure you want to leave without saving?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard"
        confirmDestructive
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          setDiscardVisible(false);
          if (pendingAction.current) {
            navigation.dispatch(pendingAction.current);
            pendingAction.current = null;
          }
        }}
      />
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  backBtnErr: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.sunsetOrange,
  },
  backBtnErrText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Save button (in native header)
  saveBtn: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    minWidth: 60,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Meta bar
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  metaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Empty state
  emptyHint: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.sunsetOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // Dirty indicator
  dirtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  dirtyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
});
