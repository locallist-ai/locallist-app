import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { formatFullDate, todayIso, addDaysIso } from '../../lib/dates';
import { DatePickerSheet } from './DatePickerSheet';

interface StartDateFieldProps {
  /** Selected start date (`yyyy-MM-dd`). Always a concrete date. */
  value: string;
  onChange: (iso: string) => void;
  /** Inclusive range. Defaults: today .. today+365 (mirrors backend window). */
  minIso?: string;
  maxIso?: string;
  /** `onDark` = white text over imagery (wizard); `onLight` = card (builder). */
  tone?: 'onDark' | 'onLight';
  /** Optional label shown above the field. */
  label?: string;
}

// Max selectable date = today + 365 DAYS (real day arithmetic), matching the
// backend `IsStartDateWithinWindow` (`today.AddDays(365)`) exactly. Calendar
// arithmetic (`year+1` with the same MM-dd) produced an impossible date on a leap
// day (today=2028-02-29 → "2029-02-29", not a real date) that crashed the picker,
// and drifted one day off the backend around leap years. Falls back to today only
// if `todayIso()` were ever malformed (it never is).
function defaultMax(): string {
  const today = todayIso();
  return addDaysIso(today, 365) ?? today;
}

/**
 * Start-date trigger used by the AI wizard (DurationStep) and the manual
 * builder. Shows the localized selected date and opens a {@link DatePickerSheet}.
 * The value is always present (default today), so the trip start date is ALWAYS
 * captured and sent.
 */
export const StartDateField: React.FC<StartDateFieldProps> = ({
  value,
  onChange,
  minIso,
  maxIso,
  tone = 'onLight',
  label,
}) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const min = minIso ?? todayIso();
  const max = maxIso ?? defaultMax();
  const onDark = tone === 'onDark';

  const formatted = formatFullDate(value, i18n.language || 'en') ?? value;

  return (
    <View>
      {label ? (
        <Text style={[styles.label, onDark ? styles.labelDark : styles.labelLight]}>{label}</Text>
      ) : null}
      <TouchableOpacity
        testID="start-date-field"
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        style={[styles.field, onDark ? styles.fieldDark : styles.fieldLight]}
        accessibilityRole="button"
        accessibilityLabel={t('datePicker.fieldA11y', { date: formatted })}
      >
        <View style={[styles.iconBubble, onDark ? styles.iconBubbleDark : styles.iconBubbleLight]}>
          <Ionicons name="calendar-outline" size={16} color={onDark ? '#FFFFFF' : colors.sunsetOrange} />
        </View>
        <Text style={[styles.value, onDark ? styles.valueDark : styles.valueLight]} numberOfLines={1}>
          {formatted}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={onDark ? 'rgba(255,255,255,0.8)' : colors.textSecondary}
        />
      </TouchableOpacity>

      <DatePickerSheet
        visible={open}
        value={value}
        minIso={min}
        maxIso={max}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelLight: {
    color: colors.textSecondary,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.85)',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  fieldLight: {
    backgroundColor: colors.bgMain,
  },
  fieldDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleLight: {
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  iconBubbleDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  value: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  valueLight: {
    color: colors.textMain,
  },
  valueDark: {
    color: '#FFFFFF',
  },
});
