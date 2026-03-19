import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors, fonts, spacing, borderRadius } from '../../../lib/theme';
import { usePlanEditor } from '../../../lib/use-plan-editor';
import { DaySection } from '../../../components/plan-editor/DaySection';
import { MoveToDay } from '../../../components/plan-editor/MoveToDay';
import { PlaceSearchModal } from '../../../components/plan-editor/PlaceSearchModal';

export default function PlanEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { plan, days, isDirty, isSaving, loading, error, dispatch, save } = usePlanEditor(id!);

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

  const handleBack = useCallback(() => {
    if (isDirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to leave?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    const success = await save();
    if (success) {
      router.back();
    }
  }, [save]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
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

  return (
    <GestureHandlerRootView style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={s.headerBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.deepOcean} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {plan.name}
          </Text>
          <Text style={s.headerSubtitle}>
            {days.reduce((acc, d) => acc + d.stops.length, 0)} stops
            {isDirty ? ' · Edited' : ''}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={!isDirty || isSaving}
          style={[s.saveBtn, (!isDirty || isSaving) && s.saveBtnDisabled]}
          accessibilityLabel="Save changes"
          accessibilityRole="button"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {days.map((day) => (
          <DaySection
            key={day.dayNumber}
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
        ))}

        {/* Dirty indicator */}
        {isDirty && (
          <View style={s.dirtyBar}>
            <Ionicons name="information-circle-outline" size={16} color={colors.sunsetOrange} />
            <Text style={s.dirtyText}>You have unsaved changes</Text>
          </View>
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
    backgroundColor: colors.electricBlue,
  },
  backBtnErrText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgMain,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    gap: spacing.sm,
  },
  headerBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: colors.electricBlue,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Dirty indicator
  dirtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  dirtyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.sunsetOrange,
  },
});
