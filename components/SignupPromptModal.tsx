import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Button } from './ui/Button';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

interface SignupPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onSignUp: () => void;
}

export function SignupPromptModal({
  visible,
  onClose,
  onSignUp,
}: SignupPromptModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>You've used your free plans</Text>
          <Text style={styles.subtitle}>
            Create a free account to unlock 5 plans per day
          </Text>

          <View style={styles.features}>
            <FeatureRow text="Save your plans and access them anywhere" />
            <FeatureRow text="5 AI plans per day (free)" />
            <FeatureRow text="Browse the full curated catalog" />
          </View>

          <Button
            title="Sign Up Free"
            onPress={onSignUp}
            variant="primary"
            size="lg"
            style={styles.signupButton}
          />

          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.checkmark}>{'\u2713'}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  features: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  checkmark: {
    color: colors.successEmerald,
    fontSize: 18,
    fontWeight: '700',
    marginRight: spacing.sm,
    width: 24,
  },
  featureText: {
    ...typography.body,
    flex: 1,
  },
  signupButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
