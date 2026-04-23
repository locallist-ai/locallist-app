import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import { OptionCard } from './OptionCard';
import type { WizardStepConfig } from './constants';

// ── Types ──

interface WizardStepProps {
  config: WizardStepConfig;
  stepIndex: number;
  selectedId: string | null;
  onSelect: (optionId: string) => void;
  onSkip: () => void;
}

// ── Component ──

export const WizardStep: React.FC<WizardStepProps> = ({
  config,
  stepIndex,
  selectedId,
  onSelect,
  onSkip,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <EditorialTitle
        text={t(config.titleKey)}
        size="md"
        color="#FFFFFF"
        withShadow
        style={styles.titleSpacing}
      />
      <StepSubtitle
        text={t(config.subtitleKey)}
        size="md"
        color="rgba(255, 255, 255, 0.7)"
        withShadow
        style={styles.subtitleSpacing}
      />

      {/* Option cards */}
      <View>
        {config.options.map((option, index) => (
          <OptionCard
            key={option.id}
            option={option}
            index={index}
            selected={selectedId === option.id}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </View>

      {/* Skip button */}
      <View style={[styles.skipWrapper, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSkip}
          style={styles.skipButton}
          accessibilityLabel={t('wizard.skip')}
          accessibilityRole="button"
        >
          <BlurView
            intensity={60}
            tint="light"
            style={styles.skipBlur}
          >
            <Text style={styles.skipText}>
              {t('wizard.skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSpacing: {
    marginBottom: 8,
  },
  subtitleSpacing: {
    marginBottom: 24,
  },
  skipWrapper: {
    marginTop: 20,
  },
  skipButton: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  skipBlur: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
