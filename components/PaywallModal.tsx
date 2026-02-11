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

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  trigger?: string;
}

export function PaywallModal({
  visible,
  onClose,
  onUpgrade,
  trigger,
}: PaywallModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Unlock LocalList Pro</Text>
          <Text style={styles.subtitle}>
            Get the full Miami experience
          </Text>

          <View style={styles.features}>
            <FeatureRow text="50 AI plans per day" />
            <FeatureRow text="Follow Mode — step-by-step navigation" />
            <FeatureRow text="Save unlimited plans" />
            <FeatureRow text="Full curated catalog — 40+ handpicked spots" />
          </View>

          <Button
            title="Upgrade to Pro"
            onPress={onUpgrade}
            variant="primary"
            size="lg"
            style={styles.upgradeButton}
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
  upgradeButton: {
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
