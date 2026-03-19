import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../lib/theme';

type Props = {
  visible: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  body: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmDestructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  visible,
  icon = 'alert-circle-outline',
  iconColor = colors.sunsetOrange,
  title,
  body,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmDestructive = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <View style={s.backdrop} />
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(250).springify()}
          exiting={FadeOut.duration(150)}
          style={s.content}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.container}>
              {/* Handle bar */}
              <View style={s.handleBar} />

              {/* Icon */}
              <View style={[s.iconWrap, { backgroundColor: iconColor + '12' }]}>
                <Ionicons name={icon} size={28} color={iconColor} />
              </View>

              {/* Text */}
              <Text style={s.title}>{title}</Text>
              <Text style={s.body}>{body}</Text>

              {/* Buttons */}
              <View style={s.buttons}>
                <TouchableOpacity activeOpacity={0.8} onPress={onCancel} style={s.cancelBtn}>
                  <Text style={s.cancelText}>{cancelLabel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onConfirm}
                  style={[s.confirmBtn, confirmDestructive && s.confirmDestructive]}
                >
                  <Text style={s.confirmText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: '85%',
    maxWidth: 340,
  },
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  cancelText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.sunsetOrange,
  },
  confirmDestructive: {
    backgroundColor: colors.error,
  },
  confirmText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
