import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { PhotoMosaic } from '../ui/PhotoMosaic';
import { type Category } from '../ui/PhotoHero';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
import { DaySection } from '../plan-editor/DaySection';
import { usePlanEditorContext } from './PlanEditorContext';
import { usePlanEditorModals } from './PlanEditorModals';
import type { Plan, PlanStop } from '../../lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlanOverviewProps {
  plan: Plan;
  stops: PlanStop[];
  totalStops: number;
  message?: string | null;
  heroPhotos: string[];
  isAuthenticated: boolean;
  isOwner: boolean;
  isNew: boolean;
  onFollow: () => void;
  onDelete?: () => void;
  onScrollToStop: (globalStopIndex: number) => void;
  currentDay: number;
  allDays: number[];
  onDayChange: (day: number) => void;
}

export const PlanOverview: React.FC<PlanOverviewProps> = React.memo(({
  plan,
  stops,
  totalStops,
  message,
  heroPhotos,
  isAuthenticated,
  isOwner,
  isNew,
  onFollow,
  onDelete,
  onScrollToStop,
  currentDay,
  allDays,
  onDayChange,
}) => {
  const { t } = useTranslation();
  const { days: editorDays, isDirty: editorIsDirty, isSaving: editorIsSaving, dispatch, save } = usePlanEditorContext();
  const { requestMove, requestAdd, requestReplace } = usePlanEditorModals();
  const heroFallback = (plan.category ?? plan.type ?? 'Culture') as Category;
  const heroSubtitle = `${plan.city} · ${t('common.dayCount', { count: plan.durationDays })}`;

  const stopsForCurrentDay = useMemo(
    () =>
      stops
        .filter((s) => (s.dayNumber || 1) === currentDay)
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [stops, currentDay],
  );

  /* ── Owner: DraggableFlatList as root scroller (no nesting conflict) ── */
  if (isOwner) {
    const editorDay = editorDays.find((d) => d.dayNumber === currentDay);
    const dayOffset = editorDays
      .filter((d) => d.dayNumber < currentDay)
      .reduce((sum, d) => sum + d.stops.length, 0);

    const dayChips = allDays.length > 1 ? (
      <View style={styles.summaryDayChips}>
        {allDays.map((d) => {
          const active = d === currentDay;
          return (
            <TouchableOpacity
              key={d}
              onPress={() => onDayChange(d)}
              activeOpacity={0.85}
              style={[styles.summaryDayChip, active && styles.summaryDayChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t('plan.dayLabel', { day: d })}
            >
              <Text style={[styles.summaryDayChipText, active && styles.summaryDayChipTextActive]}>
                {t('plan.dayLabel', { day: d })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ) : null;

    const listHeader = (
      <>
        <PhotoMosaic
          photos={heroPhotos}
          fallbackCategory={heroFallback}
          height={280}
        />
        <View style={styles.editorHeader}>
          <Text style={styles.overviewTitle}>{plan.name}</Text>
          <Text style={styles.overviewSubtitle}>{heroSubtitle}</Text>

          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <Ionicons name="location-outline" size={14} color={colors.sunsetOrange} />
              <Text style={styles.pillText}>{plan.city}</Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="calendar-outline" size={14} color={colors.sunsetOrange} />
              <Text style={styles.pillText}>
                {t('common.dayCount', { count: plan.durationDays })}
              </Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="flag-outline" size={14} color={colors.sunsetOrange} />
              <Text style={styles.pillText}>{t('common.stopCount', { count: totalStops })}</Text>
            </View>
            {plan.type && (
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{t(`planType.${plan.type}`, { defaultValue: plan.type })}</Text>
              </View>
            )}
          </View>

          {plan.description && (
            <Text style={styles.description}>{plan.description}</Text>
          )}

          {message && (
            <View style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Ionicons name="sparkles" size={16} color={colors.sunsetOrange} />
                <Text style={styles.messageLabel}>{t('plan.aiCurator')}</Text>
              </View>
              <Text style={styles.messageText}>{message}</Text>
            </View>
          )}

          <View style={styles.summaryHeader}>
            <Ionicons name="list-outline" size={16} color={colors.sunsetOrange} />
            <Text style={styles.summaryLabel}>{t('plan.whatsInside')}</Text>
          </View>

          {dayChips}
        </View>
      </>
    );

    const listEmpty = (
      <View style={styles.editorEmptyWrap}>
        <Animated.View entering={FadeInDown.duration(400).springify().damping(16)} style={styles.editorEmpty}>
          <View style={styles.editorEmptyIcon}>
            <Ionicons name="compass-outline" size={32} color={colors.sunsetOrange} />
          </View>
          <Text style={styles.editorEmptyTitle}>{t('plan.noStopsYet')}</Text>
          <Text style={styles.editorEmptyBody}>{t('plan.noStopsYetHint')}</Text>
        </Animated.View>
      </View>
    );

    const listFooter = (
      <View style={styles.editorFooter}>
        <View style={styles.ownerActions}>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              styles.ownerActionBtn,
              ((!editorIsDirty && !isNew) || editorIsSaving) && styles.saveBtnDisabled,
            ]}
            disabled={(!editorIsDirty && !isNew) || editorIsSaving}
            onPress={save}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isNew ? t('plan.createPlan') : t('plan.saveChanges')}
          >
            {editorIsSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{isNew ? t('plan.createPlan') : t('plan.saveChanges')}</Text>
              </>
            )}
          </TouchableOpacity>

          {!isNew && onDelete && (
            <TouchableOpacity
              style={[styles.deleteBtn, styles.ownerActionBtn]}
              onPress={onDelete}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete this plan"
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {editorIsDirty && (
          <View style={styles.dirtyBadge}>
            <Ionicons name="alert-circle" size={14} color={colors.sunsetOrange} />
            <Text style={styles.dirtyBadgeText}>{t('plan.unsavedChanges')}</Text>
          </View>
        )}

        {!isNew && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onFollow}
            style={styles.ctaWrap}
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? t('plan.followThisPlan') : t('plan.signInToFollow')}
          >
            <LinearGradient
              colors={[colors.electricBlue, '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.ctaText}>
                {isAuthenticated ? t('plan.startFollowMode') : t('plan.signInToFollow')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );

    return (
      <DaySection
        dayNumber={currentDay}
        stops={editorDay?.stops ?? []}
        onReorder={(from, to) =>
          dispatch({ type: 'REORDER', dayNumber: currentDay, from, to })
        }
        onDeleteStop={(stopIndex) =>
          dispatch({ type: 'DELETE_STOP', dayNumber: currentDay, stopIndex })
        }
        onMoveStop={editorDays.length > 1 ? (stopIndex) => requestMove(currentDay, stopIndex) : undefined}
        onReplaceStop={(stopIndex) => requestReplace(currentDay, stopIndex)}
        onAddPress={() => requestAdd(currentDay)}
        onStopPress={(localIdx) => onScrollToStop(dayOffset + localIdx)}
        style={styles.slot}
        contentContainerStyle={styles.slotContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
      />
    );
  }

  /* ── Non-owner: read-only ScrollView (original, unchanged) ── */
  return (
    <ScrollView
      style={styles.slot}
      contentContainerStyle={styles.slotContent}
      showsVerticalScrollIndicator={false}
    >
      <PhotoMosaic
        photos={heroPhotos}
        fallbackCategory={heroFallback}
        height={280}
      />

      <View style={styles.overviewPanel}>
        <Text style={styles.overviewTitle}>{plan.name}</Text>
        <Text style={styles.overviewSubtitle}>{heroSubtitle}</Text>

        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="location-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>{plan.city}</Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="calendar-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>
              {t('common.dayCount', { count: plan.durationDays })}
            </Text>
          </View>
          <View style={styles.pill}>
            <Ionicons name="flag-outline" size={14} color={colors.sunsetOrange} />
            <Text style={styles.pillText}>{t('common.stopCount', { count: totalStops })}</Text>
          </View>
          {plan.type && (
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{t(`planType.${plan.type}`, { defaultValue: plan.type })}</Text>
            </View>
          )}
        </View>

        {plan.description && (
          <Text style={styles.description}>{plan.description}</Text>
        )}

        {message && (
          <View style={styles.messageCard}>
            <View style={styles.messageHeader}>
              <Ionicons name="sparkles" size={16} color={colors.sunsetOrange} />
              <Text style={styles.messageLabel}>{t('plan.aiCurator')}</Text>
            </View>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* What's inside */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="list-outline" size={16} color={colors.sunsetOrange} />
            <Text style={styles.summaryLabel}>{t('plan.whatsInside')}</Text>
          </View>

          {allDays.length > 1 && (
            <View style={styles.summaryDayChips}>
              {allDays.map((d) => {
                const active = d === currentDay;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => onDayChange(d)}
                    activeOpacity={0.85}
                    style={[styles.summaryDayChip, active && styles.summaryDayChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t('plan.dayLabel', { day: d })}
                  >
                    <Text style={[styles.summaryDayChipText, active && styles.summaryDayChipTextActive]}>
                      {t('plan.dayLabel', { day: d })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {stopsForCurrentDay.map((s, idx) => {
            const rowIcon = s.timeBlock ? TIME_BLOCK_ICON[s.timeBlock] ?? DEFAULT_STOP_ICON : DEFAULT_STOP_ICON;
            const arrival = s.suggestedArrival ? ` · ${s.suggestedArrival}` : '';
            return (
              <View key={`${s.placeId}-${idx}`} style={styles.summaryRow}>
                <View style={styles.summaryRowBubble}>
                  <MaterialCommunityIcons name={rowIcon} size={14} color={colors.sunsetOrange} />
                </View>
                <View style={styles.summaryRowText}>
                  <Text style={styles.summaryRowName} numberOfLines={1}>
                    {s.place?.name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.summaryRowMeta} numberOfLines={1}>
                    {s.place?.category ? t(`category.${s.place.category}`, { defaultValue: s.place.category }) : ''}
                    {arrival}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {!isNew && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onFollow}
            style={styles.ctaWrap}
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? t('plan.followThisPlan') : t('plan.signInToFollow')}
          >
            <LinearGradient
              colors={[colors.electricBlue, '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text style={styles.ctaText}>
                {isAuthenticated ? t('plan.startFollowMode') : t('plan.signInToFollow')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
});
PlanOverview.displayName = 'PlanOverview';

const styles = StyleSheet.create({
  slot: {
    width: SCREEN_WIDTH,
    backgroundColor: colors.bgCard,
  },
  slotContent: {
    flexGrow: 1,
    paddingBottom: 110,
    backgroundColor: colors.bgCard,
  },
  summaryDayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  summaryDayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
  },
  summaryDayChipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  summaryDayChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  summaryDayChipTextActive: {
    color: '#FFFFFF',
  },

  /* Overview — shared */
  overviewPanel: {
    marginTop: -24,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  overviewTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.deepOcean,
  },
  overviewSubtitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.sunsetOrange + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.deepOcean,
  },
  typePill: {
    backgroundColor: colors.deepOcean,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  typePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMain,
  },
  messageCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.sunsetOrange,
  },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  messageLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.sunsetOrange },
  messageText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMain },
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderColor,
    gap: spacing.sm,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  summaryRowBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRowText: { flex: 1 },
  summaryRowName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  summaryRowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Editor owner header/footer (DraggableFlatList as root) */
  editorHeader: {
    marginTop: -24,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  editorFooter: {
    backgroundColor: colors.bgCard,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  editorEmptyWrap: {
    paddingHorizontal: spacing.lg,
  },
  editorEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  editorEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sunsetOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  editorEmptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepOcean,
  },
  editorEmptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 240,
  },

  /* Owner actions */
  ownerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ownerActionBtn: {
    flex: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
    backgroundColor: colors.sunsetOrange,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.error + '40',
    backgroundColor: colors.error + '08',
  },
  deleteBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.error },
  dirtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  dirtyBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
  ctaWrap: { marginTop: spacing.xs },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: borderRadius.lg,
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
});
