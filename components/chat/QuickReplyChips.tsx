import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, borderRadius } from '../../lib/theme';
import type { QuickReply } from '../../lib/types';

type Props = {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
};

export function QuickReplyChips({ replies, onSelect }: Props) {
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
          style={styles.chip}
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(reply);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText}>{reply.label}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: borderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paperWhite,
  },
});
