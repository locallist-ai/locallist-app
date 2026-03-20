import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

type Props = {
  visible: boolean;
  currentDay: number;
  totalDays: number;
  onSelect: (toDay: number) => void;
  onClose: () => void;
};

export function MoveToDay({ visible, currentDay, totalDays, onSelect, onClose }: Props) {
  const days = Array.from({ length: totalDays }, (_, i) => i + 1).filter(
    (d) => d !== currentDay,
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={s.sheet}>
              <View style={s.header}>
                <Text style={s.title}>Move to Day</Text>
                <TouchableOpacity onPress={onClose} accessibilityRole="button">
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={s.grid}>
                {days.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={s.dayBtn}
                    onPress={() => onSelect(day)}
                    activeOpacity={0.7}
                    accessibilityLabel={`Move to day ${day}`}
                    accessibilityRole="button"
                  >
                    <Text style={s.dayBtnText}>Day {day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 18,
    color: colors.deepOcean,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.sunsetOrange + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.sunsetOrange + '30',
  },
  dayBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.sunsetOrange,
  },
});
