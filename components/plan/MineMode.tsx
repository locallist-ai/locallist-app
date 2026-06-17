import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { ConfirmModal } from '../ui/ConfirmModal';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import { SelectionBar } from './SelectionBar';
import type { Plan } from '../../lib/types';

type Props = {
  insets: EdgeInsets;
  myPlans: Plan[];
  selectionMode: boolean;
  selectedIds: Set<string>;
  bulkDeleteVisible: boolean;
  bulkDeleting: boolean;
  onBack: () => void;
  onRowPress: (id: string) => void;
  onRowLongPress: (id: string) => void;
  onExitSelection: () => void;
  onRequestBulkDelete: () => void;
  onConfirmBulkDelete: () => void;
  onCancelBulkDelete: () => void;
};

export function MineMode({
  insets,
  myPlans,
  selectionMode,
  selectedIds,
  bulkDeleteVisible,
  bulkDeleting,
  onBack,
  onRowPress,
  onRowLongPress,
  onExitSelection,
  onRequestBulkDelete,
  onConfirmBulkDelete,
  onCancelBulkDelete,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <TouchableOpacity
        onPress={onBack}
        style={[s.floatingClose, { top: insets.top + spacing.xs }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={selectionMode ? t('plans.selectionCancel') : 'Back to plans menu'}
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      {myPlans.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="bookmark-outline" size={56} color={colors.sunsetOrange} />
          <Text style={[s.emptyTitle, s.emptyTitleOnHero]}>{t('plans.emptyMineTitle')}</Text>
          <Text style={[s.emptyBody, s.emptyBodyOnHero]}>{t('plans.emptyMineBody')}</Text>
        </View>
      ) : (
        <FlatList
          data={myPlans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, { paddingTop: insets.top + spacing.lg, paddingBottom: selectionMode ? 100 : spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={s.listHeader}>
              <EditorialTitle
                text={selectionMode ? t('plans.selectionTitle', { count: selectedIds.size }) : t('plans.myPlans')}
                size="md"
                align="left"
                color="#FFFFFF"
                withShadow
              />
              <StepSubtitle
                text={
                  selectionMode
                    ? t('plans.selectionHint')
                    : t('plans.myPlansCount', { count: myPlans.length, s: myPlans.length === 1 ? '' : 's' })
                }
                size="md"
                align="left"
                color="rgba(255,255,255,0.75)"
                withShadow
                style={{ marginTop: 6 }}
              />
            </View>
          }
          renderItem={({ item, index }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <Animated.View entering={FadeInDown.delay(index * 70).duration(380)}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onRowPress(item.id)}
                  onLongPress={() => onRowLongPress(item.id)}
                  delayLongPress={350}
                >
                  <BlurView
                    intensity={50}
                    tint="light"
                    style={[s.myPlanRow, isSelected && s.myPlanRowSelected]}
                  >
                    <View style={s.myPlanIcon}>
                      {selectionMode ? (
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={isSelected ? colors.sunsetOrange : 'rgba(15,23,42,0.4)'}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="map-marker-radius"
                          size={20}
                          color={colors.sunsetOrange}
                        />
                      )}
                    </View>
                    <View style={s.myPlanInfo}>
                      <Text style={s.myPlanName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.myPlanMeta}>
                        {item.city} · {t('common.dayCount', { count: item.durationDays })}
                      </Text>
                    </View>
                    {!selectionMode && (
                      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
                    )}
                  </BlurView>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}

      {selectionMode && selectedIds.size > 0 && (
        <SelectionBar
          insets={insets}
          count={selectedIds.size}
          onCancel={onExitSelection}
          onDelete={onRequestBulkDelete}
        />
      )}

      <ConfirmModal
        visible={bulkDeleteVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title={t('plans.selectionConfirmTitle', { count: selectedIds.size })}
        body={t('plans.selectionConfirmBody')}
        confirmLabel={bulkDeleting ? t('plans.selectionConfirmDeleting') : t('plans.selectionConfirmDelete')}
        confirmDestructive
        onCancel={onCancelBulkDelete}
        onConfirm={onConfirmBulkDelete}
      />
    </>
  );
}

const s = StyleSheet.create({
  floatingClose: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  listHeader: {
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.deepOcean,
    marginTop: spacing.md,
  },
  emptyTitleOnHero: {
    color: colors.sunsetOrange,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyBodyOnHero: {
    color: colors.sunsetOrange + 'D9', // ~85% alpha — un poco más suave
    textShadowColor: 'rgba(0,0,0,0.30)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  myPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  myPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlanRowSelected: {
    borderColor: colors.sunsetOrange,
    borderWidth: 2,
  },
  myPlanInfo: {
    flex: 1,
  },
  myPlanName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  myPlanMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
});
