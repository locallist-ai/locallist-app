import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
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
          <Image source={require('../../assets/images/icon.png')} style={styles.avatarIcon} resizeMode="contain" />
        </View>
      )}
      {isUser ? (
        <View style={[styles.bubble, styles.bubbleUser]}>
          <Text style={styles.textUser}>{message.text}</Text>
        </View>
      ) : (
        <View style={styles.bubbleAiOuter}>
          <BlurView intensity={70} tint="light" style={styles.bubbleAiInner}>
            {/* aiMessage MUST render as plain Text — XSS defense (no Markdown, no WebView) */}
            <Text style={styles.text}>{message.text}</Text>
          </BlurView>
        </View>
      )}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 115, 22, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarIcon: {
    width: 18,
    height: 22,
  },
  bubbleAiOuter: {
    maxWidth: '75%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomLeftRadius: 4,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  bubbleAiInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: colors.electricBlue,
    borderBottomRightRadius: 4,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.deepOcean,
  },
  textUser: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
  },
});
