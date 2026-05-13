import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, borderRadius } from '../../lib/theme';
import type { QuickReply } from '../../lib/types';

type Props = {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
  disabled?: boolean;
};

export function QuickReplyChips({ replies, onSelect, disabled }: Props) {
  if (replies.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {replies.map((reply) => (
        <TouchableOpacity
          key={reply.id}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => {
            if (disabled) return;
            Haptics.selectionAsync();
            onSelect(reply);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, disabled && styles.chipTextDisabled]}>
            {reply.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.electricBlue,
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipDisabled: {
    borderColor: colors.borderColor,
    opacity: 0.5,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.electricBlue,
  },
  chipTextDisabled: {
    color: colors.textSecondary,
  },
});
