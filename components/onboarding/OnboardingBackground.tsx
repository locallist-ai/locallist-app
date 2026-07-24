import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../lib/theme';
import { ProgressDots } from '../ui/design-system';
import { OnboardingSkiaBg } from './OnboardingSkiaBg';

// Shared chrome for the onboarding flow: a MUCH lighter, animated backdrop that
// echoes the builder/home Skia motif (itinerary pins + drifting dotted route +
// a walker). A very subtle warm→cool cream gradient sits under a light-tuned
// variant of that motif (OnboardingSkiaBg), so the whole flow reads bright and
// editorial. Renders a top bar with an optional back affordance and the shared
// progress indicator, then the screen content below. All step children now
// assume a LIGHT backdrop (deepOcean/textMain copy, no text shadows).

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
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      {/* Base: very subtle warm→cool cream wash (bgMain in the middle so the
          content band stays neutral for dark text). */}
      <LinearGradient
        colors={[colors.sunsetOrangeLight, colors.bgMain, colors.electricBlueLight]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Animated itinerary motif (light-tuned, decorative). */}
      <OnboardingSkiaBg />

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
              <Ionicons name="chevron-back" size={26} color={colors.deepOcean} />
            </TouchableOpacity>
          )}
        </View>
        <ProgressDots
          current={step}
          total={totalSteps}
          size="md"
          colorPending="rgba(15, 23, 42, 0.15)"
        />
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
