import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../lib/theme';
import { ProgressDots } from '../ui/design-system';

// Shared chrome for the onboarding flow: the same warm hero image + dark overlay
// used by the home city picker and the wizard, so the reused CityCard / ChoiceChip
// / ProgressDots (all designed for a dark editorial backdrop) read correctly on
// every step. Renders a top bar with an optional back affordance and the shared
// progress indicator, then the screen content below.

interface OnboardingBackgroundProps {
  /** 0-based index of the active step, for ProgressDots. */
  step: number;
  /** Total number of steps in the flow. */
  totalSteps: number;
  /** Back handler. When omitted (first step) the back affordance is hidden. */
  onBack?: () => void;
  children: React.ReactNode;
}

export function OnboardingBackground({ step, totalSteps, onBack, children }: OnboardingBackgroundProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[styles.bgImage, { width: width + 200, height: height + 300 }]}
        resizeMode="cover"
      />
      <View style={styles.bgOverlay} />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarSide}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              testID="onboarding-back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.paperWhite} />
            </TouchableOpacity>
          )}
        </View>
        <ProgressDots current={step} total={totalSteps} size="md" />
        <View style={styles.topBarSide} />
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  bgImage: {
    position: 'absolute',
    top: -50,
    left: -100,
    opacity: 0.55,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarSide: {
    width: 40,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
