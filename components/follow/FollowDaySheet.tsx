import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { TIME_BLOCK_ICON, DEFAULT_STOP_ICON } from '../../lib/timeBlocks';
import type { PlanStop } from '../../lib/types';

// Follow Mode day list — Pablo 2026-04-26: "show day 1: -coffee or breakfast,
// -activity, -lunch, -activity, -dinner. Each have edit button right here."
//
// Sustituye al BottomSheetStop single-card con un listado del día activo.
// Cada fila es tocable (focus en el mapa) y tiene un menu (...) con opciones
// editables: Replace place / Skip / Delete.
//
// Edit handlers:
//  - onReplace: el padre abre PlaceSearchModal y persiste el cambio.
//  - onDelete: el padre confirma + persiste.
// El sheet en sí solo dispara los handlers; toda la persistencia vive en
// app/follow/[id].tsx para tener control sobre la API.
//
// Pablo 2026-04-27 evening: el sheet ahora es colapsable — tap en el handle
// bar (o drag down) lo baja para revelar el mapa a pantalla completa. Tap
// otra vez (o drag up) lo expande. Pause button removido por redundante
// (era equivalente al chevron back de la pantalla).

/** Cantidad de píxeles del sheet que quedan visibles cuando está colapsado. */
const COLLAPSED_PEEK_HEIGHT = 56;
/** Threshold de drag (% del recorrido) para commitear toggle al soltar. */
const COMMIT_THRESHOLD = 0.35;

interface FollowDaySheetProps {
  /** Todos los stops del plan, ya con dayNumber poblado. */
  allStops: PlanStop[];
  /** Index activo (lineal sobre allStops). */
  currentIndex: number;
  /** Cambiar el stop activo (linear index sobre allStops). */
  onSelect: (linearIndex: number) => void;
  /** Cambiar al día siguiente/anterior cuando hay multi-día. */
  onChangeDay?: (day: number) => void;
  /** Acciones por stop (las dispara el padre, persistencia + reload). */
  onReplaceStop?: (stop: PlanStop) => void;
  onDeleteStop?: (stop: PlanStop) => void;
  /** Marca el plan como completo. */
  onComplete?: () => void;
  /** ¿El usuario es owner? Solo el owner puede editar/borrar. */
  canEdit?: boolean;
}

export const FollowDaySheet: React.FC<FollowDaySheetProps> = ({
  allStops,
  currentIndex,
  onSelect,
  onChangeDay,
  onReplaceStop,
  onDeleteStop,
  onComplete,
  canEdit = false,
}) => {
  const insets = useSafeAreaInsets();
  const currentStop = allStops[currentIndex];
  const currentDay = currentStop?.dayNumber ?? 1;

  // Stops del día activo + sus indices linear (para onSelect).
  const dayItems = useMemo(() => {
    const items: { stop: PlanStop; linearIndex: number }[] = [];
    allStops.forEach((stop, i) => {
      if (stop.dayNumber === currentDay) items.push({ stop, linearIndex: i });
    });
    items.sort((a, b) => a.stop.orderIndex - b.stop.orderIndex);
    return items;
  }, [allStops, currentDay]);

  // ¿Hay multi-día?
  const allDays = useMemo(() => {
    const days = new Set<number>();
    allStops.forEach((s) => days.add(s.dayNumber));
    return Array.from(days).sort();
  }, [allStops]);

  // Collapse state (Pablo 2026-04-27): translateY=0 expanded, =maxOffset collapsed.
  const [collapsed, setCollapsed] = useState(false);
  const sheetHeight = useSharedValue(0);
  const translateY = useSharedValue(0);

  const onLayoutSheet = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && sheetHeight.value !== h) {
      sheetHeight.value = h;
      // Si ya está colapsado, re-aplica el offset al nuevo height.
      if (collapsed) translateY.value = h - COLLAPSED_PEEK_HEIGHT;
    }
  };

  const setCollapsedJS = useCallback((next: boolean) => {
    setCollapsed(next);
    Haptics.selectionAsync();
  }, []);

  const toggleCollapse = useCallback(() => {
    'worklet';
    const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
    const target = translateY.value > max / 2 ? 0 : max;
    translateY.value = withSpring(target, { damping: 22, stiffness: 200 });
    runOnJS(setCollapsedJS)(target !== 0);
  }, [setCollapsedJS, sheetHeight, translateY]);

  // Tap en el handle bar = toggle.
  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        'worklet';
        toggleCollapse();
      }),
    [toggleCollapse],
  );

  // Pan en el handle bar = drag fino con commit por threshold/velocity.
  const panGesture = useMemo(() => {
    const startY = { value: 0 };
    return Gesture.Pan()
      .onStart(() => {
        'worklet';
        startY.value = translateY.value;
      })
      .onChange((e) => {
        'worklet';
        const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
        const next = Math.max(0, Math.min(max, startY.value + e.translationY));
        translateY.value = next;
      })
      .onEnd((e) => {
        'worklet';
        const max = sheetHeight.value - COLLAPSED_PEEK_HEIGHT;
        // Commit por velocity rápida o por posición pasada el threshold.
        const fastDown = e.velocityY > 800;
        const fastUp = e.velocityY < -800;
        const past = translateY.value > max * COMMIT_THRESHOLD;
        const target = fastUp ? 0 : fastDown ? max : past ? max : 0;
        translateY.value = withSpring(target, { damping: 22, stiffness: 200, velocity: e.velocityY });
        runOnJS(setCollapsedJS)(target !== 0);
      });
  }, [setCollapsedJS, sheetHeight, translateY]);

  const handleGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleEditMenu = (stop: PlanStop) => {
    if (!canEdit) return;
    Haptics.selectionAsync();
    Alert.alert(
      stop.place?.name ?? 'Stop',
      'What would you like to do with this stop?',
      [
        {
          text: 'Replace place',
          onPress: () => onReplaceStop?.(stop),
        },
        {
          text: 'Delete stop',
          style: 'destructive',
          onPress: () => onDeleteStop?.(stop),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <Animated.View
      style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }, animatedSheetStyle]}
      onLayout={onLayoutSheet}
    >
      <GestureDetector gesture={handleGesture}>
        <View style={styles.handleBar} accessibilityRole="button" accessibilityLabel={collapsed ? 'Expand stops list' : 'Collapse stops list to see map'}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>

      {/* Day switcher */}
      <View style={styles.daySwitcherRow}>
        <Text style={styles.dayTitle}>Day {currentDay}</Text>
        {allDays.length > 1 && (
          <View style={styles.daySwitcher}>
            {allDays.map((d) => {
              const active = d === currentDay;
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => {
                    if (active || !onChangeDay) return;
                    Haptics.selectionAsync();
                    onChangeDay(d);
                  }}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${d}`}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Stops list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {dayItems.map(({ stop, linearIndex }, idx) => {
          const isActive = linearIndex === currentIndex;
          const iconName = stop.timeBlock
            ? TIME_BLOCK_ICON[stop.timeBlock] ?? DEFAULT_STOP_ICON
            : DEFAULT_STOP_ICON;
          const arrival = stop.suggestedArrival ?? '';
          const isLast = idx === dayItems.length - 1;
          return (
            <TouchableOpacity
              key={`${stop.placeId}-${idx}`}
              onPress={() => onSelect(linearIndex)}
              activeOpacity={0.85}
              style={[styles.row, isActive && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${stop.place?.name ?? 'Stop'} ${arrival}`}
            >
              {/* Time-block + connector */}
              <View style={styles.timeCol}>
                <View style={[styles.emojiBubble, isActive && styles.emojiBubbleActive]}>
                  <MaterialCommunityIcons
                    name={iconName}
                    size={18}
                    color={isActive ? '#FFFFFF' : colors.sunsetOrange}
                  />
                </View>
                {!isLast && <View style={styles.connector} />}
              </View>

              {/* Content */}
              <View style={styles.contentCol}>
                <View style={styles.rowHeader}>
                  {arrival && <Text style={styles.timeText}>{arrival}</Text>}
                  {stop.place?.category && (
                    <Text style={styles.categoryText}>· {stop.place.category}</Text>
                  )}
                </View>
                <Text
                  style={[styles.nameText, isActive && styles.nameTextActive]}
                  numberOfLines={2}
                >
                  {stop.place?.name ?? 'Unknown place'}
                </Text>
                {stop.place?.neighborhood && (
                  <Text style={styles.neighborhoodText} numberOfLines={1}>
                    {stop.place.neighborhood}
                  </Text>
                )}
              </View>

              {/* Edit menu (solo owner) */}
              {canEdit && (
                <TouchableOpacity
                  onPress={() => handleEditMenu(stop)}
                  hitSlop={10}
                  style={styles.menuBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Edit stop"
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        {dayItems.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No stops in this day yet.</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer action — solo Complete day. Pause removido por redundante (era
          equivalente al chevron back de la pantalla — Pablo 2026-04-27). */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={onComplete}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.footerBtnPrimaryText}>Complete day</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    flex: 1,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderColor,
  },
  daySwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  dayTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
  },
  daySwitcher: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  dayChipActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  dayChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.deepOcean,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: spacing.sm,
    borderRadius: borderRadius.md,
  },
  rowActive: {
    backgroundColor: colors.sunsetOrange + '12',
  },
  timeCol: {
    alignItems: 'center',
    width: 40,
  },
  emojiBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBubbleActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: colors.borderColor,
    marginTop: 4,
  },
  contentCol: {
    flex: 1,
    paddingTop: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  timeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.sunsetOrange,
  },
  categoryText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  nameText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 16,
    color: colors.deepOcean,
    lineHeight: 21,
  },
  nameTextActive: {
    color: colors.deepOcean,
  },
  neighborhoodText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuBtn: {
    padding: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  footerBtnPrimary: {
    backgroundColor: colors.sunsetOrange,
  },
  footerBtnPrimaryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
