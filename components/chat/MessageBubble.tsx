import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, borderRadius } from '../../lib/theme';
import type { ChatMessage } from '../../lib/types';

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>✦</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        {/* aiMessage MUST render as plain Text — XSS defense (no Markdown, no WebView) */}
        <Text style={[styles.text, isUser && styles.textUser]}>{message.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAi: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.electricBlue,
    borderBottomRightRadius: 4,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMain,
  },
  textUser: {
    color: '#fff',
  },
});
