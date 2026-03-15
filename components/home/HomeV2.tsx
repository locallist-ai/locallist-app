import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
  useAnimatedSensor,
  SensorType,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { CITIES, STEPS, TOTAL_STEPS } from './constants';
import { useWizard } from './useWizard';
import { HomeLanding } from './HomeLanding';
import { CityCard } from './CityCard';
import { WizardStep } from './WizardStep';
import { ChatStep } from './ChatStep';
import { StepDecorations } from './StepDecorations';
import { ProgressDots } from './ProgressDots';

// ── Component ──

export const HomeV2: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const wizard = useWizard();

  // Crossfade: both views stay mounted, animate opacity on UI thread
  const wizardProgress = useSharedValue(0);
  useEffect(() => {
    wizardProgress.value = withTiming(wizard.showWizard ? 1 : 0, { duration: 350 });
  }, [wizard.showWizard]);

  const landingStyle = useAnimatedStyle(() => ({
    opacity: 1 - wizardProgress.value,
  }));
  const wizardStyle = useAnimatedStyle(() => ({
    opacity: wizardProgress.value,
  }));

  const landingPointerEvents = wizard.showWizard ? 'none' as const : 'auto' as const;
  const wizardPointerEvents = wizard.showWizard ? 'auto' as const : 'none' as const;

  // Parallax background via device sensor
  // When wizard is fully visible (wizardProgress=1), factor=0 → no transform work on GPU
  const animatedSensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });
  const bgStyle = useAnimatedStyle(() => {
    const factor = 1 - wizardProgress.value;
    if (factor < 0.01) return {}; // Skip transform entirely when wizard covers landing
    const { pitch, roll } = animatedSensor.sensor.value;
    return {
      transform: [
        { translateX: interpolate(roll, [-0.5, 0.5], [-20, 20], Extrapolate.CLAMP) * factor },
        { translateY: interpolate(pitch, [-0.5, 0.5], [-20, 20], Extrapolate.CLAMP) * factor },
      ],
    };
  });

  // Step transition animations
  const entering = wizard.direction === 'forward'
    ? SlideInRight.duration(400).springify().damping(18)
    : SlideInLeft.duration(400).springify().damping(18);
  const exiting = wizard.direction === 'forward'
    ? SlideOutLeft.duration(300)
    : SlideOutRight.duration(300);

  const isCityStep = wizard.step === 0;
  const currentStepConfig = (wizard.step >= 1 && wizard.step <= 4) ? STEPS[wizard.step - 1] : null;
  const isChatStep = wizard.step === 5;

  return (
    <View style={styles.root}>
      {/* Parallax background */}
      <Animated.Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[styles.bgImage, { width: screenWidth + 200, height: screenHeight + 300 }, bgStyle]}
        resizeMode="cover"
      />
      <View style={styles.bgOverlay} />

      {/* Home Landing — crossfaded with wizard */}
      <Animated.View pointerEvents={landingPointerEvents} style={[styles.fullAbsolute, landingStyle]}>
        <HomeLanding
          onCreatePlan={wizard.openWizard}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      </Animated.View>

      {/* Wizard — crossfaded with landing */}
      <Animated.View
        pointerEvents={wizardPointerEvents}
        style={[styles.fullAbsolute, { paddingTop: insets.top + 12 }, wizardStyle]}
      >
        {/* Header: back button + progress dots */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={wizard.handleBack}
            activeOpacity={0.7}
            style={styles.backButton}
            accessibilityLabel={wizard.step === 0 ? 'Close' : 'Back'}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.dotsCenter}>
            <ProgressDots current={wizard.step} total={TOTAL_STEPS} />
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Decorations layer */}
        <StepDecorations step={wizard.step} screenWidth={screenWidth} screenHeight={screenHeight} />

        {/* Step content */}
        <View style={styles.stepContent}>
          {isCityStep && (
            <Animated.View key="step-city" entering={entering} exiting={exiting} style={styles.stepFill}>
              <Text style={styles.cityTitle}>{t('destination.title')}</Text>
              <Text style={styles.citySubtitle}>{t('destination.subtitle')}</Text>
              <View style={styles.cityList}>
                {CITIES.map((city, index) => (
                  <CityCard key={city.name} city={city} index={index} onSelect={wizard.handleCitySelect} />
                ))}
              </View>
            </Animated.View>
          )}

          {currentStepConfig && (
            <Animated.View key={`step-${wizard.step}`} entering={entering} exiting={exiting}>
              <WizardStep
                config={currentStepConfig}
                stepIndex={wizard.step}
                selectedId={wizard.selections[wizard.step - 1]}
                onSelect={wizard.handleSelect}
                onSkip={wizard.advanceToNext}
              />
            </Animated.View>
          )}

          {isChatStep && (
            <Animated.View key="step-chat" entering={entering} exiting={exiting} style={styles.stepFill}>
              <ChatStep
                message={wizard.message}
                onChangeMessage={wizard.setMessage}
                showBubbleText={wizard.showBubbleText}
                loading={wizard.loading}
                error={wizard.error}
                onGenerate={wizard.handleGenerate}
              />
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

// ── Styles ──

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -200,
  },
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -100,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  fullAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepFill: {
    flex: 1,
    justifyContent: 'center',
  },
  cityTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 38,
    lineHeight: 46,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  citySubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 36,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cityList: {
    width: '100%',
  },
});
