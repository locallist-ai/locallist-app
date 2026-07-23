import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { parseIsoDate, toIsoDate, todayIso } from '../../lib/dates';

interface DatePickerSheetProps {
  visible: boolean;
  /** Currently selected date (`yyyy-MM-dd`). */
  value: string;
  /** Inclusive selectable range. */
  minIso: string;
  maxIso: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const WEEKDAY_REF = new Date(2024, 5, 2); // a Sunday (2 Jun 2024) → build Sun..Sat labels

function monthIndex(iso: string): number {
  const d = parseIsoDate(iso)!;
  return d.getFullYear() * 12 + d.getMonth();
}

/**
 * Lightweight month-grid date picker. Deliberately built from RN primitives
 * (no `@react-native-community/datetimepicker`) so it needs no extra native
 * module in the dev-client. Localized month/weekday headers via `Intl`.
 */
export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  visible,
  value,
  minIso,
  maxIso,
  onSelect,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const initial = parseIsoDate(value) ?? parseIsoDate(todayIso())!;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  // When (re)opened, jump the visible month to the selected value.
  useEffect(() => {
    if (visible) {
      const d = parseIsoDate(value) ?? parseIsoDate(todayIso())!;
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const weekdayLabels = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
      return Array.from({ length: 7 }, (_, i) =>
        fmt.format(new Date(WEEKDAY_REF.getFullYear(), WEEKDAY_REF.getMonth(), WEEKDAY_REF.getDate() + i)),
      );
    } catch {
      return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    }
  }, [locale]);

  const monthTitle = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    try {
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(first);
    } catch {
      return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    }
  }, [viewYear, viewMonth, locale]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const leading = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(toIsoDate(new Date(viewYear, viewMonth, day)));
    }
    return out;
  }, [viewYear, viewMonth]);

  const currentMonthIdx = viewYear * 12 + viewMonth;
  const canGoPrev = currentMonthIdx > monthIndex(minIso);
  const canGoNext = currentMonthIdx < monthIndex(maxIso);

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.cancel')}>
        {/* Inner Pressable swallows taps so pressing the card doesn't dismiss. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('datePicker.title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              onPress={goPrev}
              disabled={!canGoPrev}
              testID="date-prev-month"
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('datePicker.prevMonth')}
            >
              <Ionicons name="chevron-back" size={20} color={canGoPrev ? colors.deepOcean : colors.borderColor} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              onPress={goNext}
              disabled={!canGoNext}
              testID="date-next-month"
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('datePicker.nextMonth')}
            >
              <Ionicons name="chevron-forward" size={20} color={canGoNext ? colors.deepOcean : colors.borderColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {weekdayLabels.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((iso, idx) => {
              if (!iso) return <View key={`blank-${idx}`} style={styles.cell} />;
              const disabled = iso < minIso || iso > maxIso;
              const selected = iso === value;
              const isToday = iso === todayIso();
              return (
                <TouchableOpacity
                  key={iso}
                  testID={`date-cell-${iso}`}
                  disabled={disabled}
                  onPress={() => { onSelect(iso); onClose(); }}
                  style={[styles.cell, selected && styles.cellSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                >
                  <Text
                    style={[
                      styles.cellText,
                      disabled && styles.cellTextDisabled,
                      selected && styles.cellTextSelected,
                      isToday && !selected && styles.cellTextToday,
                    ]}
                  >
                    {Number(iso.slice(8, 10))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const CELL = `${100 / 7}%`;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.deepOcean,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgMain,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepOcean,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    width: CELL,
    textAlign: 'center',
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  cellSelected: {
    backgroundColor: colors.sunsetOrange,
    borderRadius: borderRadius.full,
  },
  cellText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
  },
  cellTextDisabled: {
    color: colors.borderColor,
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemiBold,
  },
  cellTextToday: {
    color: colors.sunsetOrange,
    fontFamily: fonts.bodySemiBold,
  },
});
