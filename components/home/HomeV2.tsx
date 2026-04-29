import React from 'react';
import { View, Text, TouchableOpacity, Image, useWindowDimensions, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '../../lib/theme';
import {
  CITIES,
  STEPS,
  TOTAL_STEPS,
  WIZARD_ONLY,
  INTERESTS_STEP_INDEX_IN_STEPS,
  COMPANY_SUBCATEGORIES,
} from './constants';
import { useWizard } from './useWizard';
import { CityCard } from './CityCard';
import { WizardStep } from './WizardStep';
import { ChatStep } from './ChatStep';
import { InterestsStep } from './InterestsStep';
import { BudgetStep } from './BudgetStep';
import { RefineableStep } from './RefineableStep';
// StepDecorations + FloatingEmoji quedan en el repo como dead code reusable
// para una futura capa de "branded particles". Pablo 2026-04-25 pidió quitar
// los emojis legacy del bg — el wizard se ve más editorial sin ellos.
import { ProgressDots } from './ProgressDots';
import { HeroSkiaBg } from './HeroSkiaBg';

// ── Component ──

export const HomeV2: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const wizard = useWizard();

  // Animations stripped per Pablo 2026-04-26. Hero photo se renderiza
  // estático. Si Pablo cambia de opinión, el variant 'skia' o 'veo' siguen
  // disponibles en el dev menu de Account.

  // Step transitions sin animación. Pablo 2026-04-26: "eliminar por completo
  // las animaciones". Cambio inmediato entre steps. Si en el futuro queremos
  // reactivarlas, usar FadeIn(220) + FadeOut(140) — eran muy sutiles y
  // probablemente OK, pero respetamos la directiva.
  const entering = undefined;
  const exiting = undefined;

  const isCityStep = wizard.step === 0;
  const stepIndexInSteps = wizard.step - 1; // 0..STEPS.length-1
  // Steps con drill-down sheet (single-select parent + sub-tags single):
  // index 1 = company. Index 2 = interests (multi parents).
  const isCompanyStep = stepIndexInSteps === 1;
  const isInterestsStep = stepIndexInSteps === INTERESTS_STEP_INDEX_IN_STEPS;
  // Budget = último step. Custom input numérico, no chips (Pablo 2026-04-25).
  const isBudgetStep = stepIndexInSteps === STEPS.length - 1;
  // Steps que usan WizardStep estándar (single-select sin drill-down): solo
  // duration (index 0) tras los cambios de Pablo.
  const usesWizardStep =
    stepIndexInSteps >= 0 &&
    stepIndexInSteps < STEPS.length &&
    !isCompanyStep &&
    !isInterestsStep &&
    !isBudgetStep;
  const currentStepConfig = usesWizardStep ? STEPS[stepIndexInSteps] : null;
  // Chat step queda como step 6 cuando WIZARD_ONLY=false (legacy). En
  // WIZARD_ONLY no se alcanza nunca — el ChatStep code se conserva intacto.
  const isChatStep = wizard.step === STEPS.length + 1;

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/images/hero-bg.jpg')}
        style={[styles.bgImage, { width: screenWidth + 200, height: screenHeight + 300 }]}
        resizeMode="cover"
      />
      <HeroSkiaBg />
      <View style={styles.bgOverlay} />

      {/* Wizard */}
      <View style={[styles.fullAbsolute, { paddingTop: insets.top + 12 }]}>
        {/* Header: back button (hidden on step 0) + progress dots */}
        <View style={styles.header}>
          {wizard.step > 0 ? (
            <TouchableOpacity
              onPress={wizard.handleBack}
              activeOpacity={0.7}
              style={styles.backButton}
              accessibilityLabel="Back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <View style={styles.dotsCenter}>
            <ProgressDots current={wizard.step} total={TOTAL_STEPS} />
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Decorations layer eliminada — Pablo 2026-04-25: emojis flotando
          * desentonan con el lenguaje editorial. StepDecorations + FloatingEmoji
          * quedan como dead code en el repo para reusar si en el futuro
          * cambiamos a "branded particles". */}

        {/* Step content. Pablo 2026-04-26: cuando WIZARD_ONLY está generando o
          * tiene error, mostramos SOLO el overlay (sin renderizar el step de
          * fondo) para que no parezca que la página se "reabre". */}
        <View style={styles.stepContent}>
          {WIZARD_ONLY && (wizard.loading || wizard.error) ? null : (
          <>
          {isCityStep && (
            <Animated.View key="step-city" entering={entering} exiting={exiting} style={styles.stepFillTop}>
              <Text style={styles.cityTitle}>{t('destination.title')}</Text>
              <Text style={styles.citySubtitle}>{t('destination.subtitle')}</Text>
              <View style={styles.cityList}>
                {CITIES.map((city, index) => (
                  <CityCard
                    key={city.name}
                    city={city}
                    index={index}
                    selected={wizard.city === city.name}
                    onSelect={wizard.handleCitySelect}
                  />
                ))}
              </View>
              {/* Continue button — Pablo 2026-04-26: avance manual en cada step. */}
              <View style={[styles.cityContinueWrap, { paddingBottom: insets.bottom + 20 }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={wizard.advanceToNext}
                  accessibilityRole="button"
                  accessibilityLabel={wizard.city ? t('wizard.interestContinue') : t('wizard.skip')}
                >
                  <BlurView intensity={60} tint="light" style={styles.cityContinueBlur}>
                    <Text style={styles.cityContinueText}>
                      {wizard.city ? t('wizard.interestContinue') : t('wizard.skip')}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </BlurView>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {currentStepConfig && (
            <Animated.View key={`step-${wizard.step}`} entering={entering} exiting={exiting} style={styles.stepFill}>
              <WizardStep
                config={currentStepConfig}
                stepIndex={wizard.step}
                selectedId={wizard.selections[wizard.step - 1]}
                onSelect={wizard.handleSelect}
                onSkip={wizard.advanceToNext}
              />
            </Animated.View>
          )}

          {isCompanyStep && (
            <Animated.View key="step-company" entering={entering} exiting={exiting} style={styles.stepFill}>
              <RefineableStep
                config={STEPS[1]}
                selectedId={wizard.selections[1]}
                subOptionsByParent={COMPANY_SUBCATEGORIES}
                selectedSubs={wizard.companySubs}
                onSelect={wizard.selectCompany}
                onSetSubs={wizard.setCompanySubs}
                onContinue={wizard.advanceToNext}
                mode="single"
              />
            </Animated.View>
          )}

          {isInterestsStep && (
            <Animated.View key="step-interests" entering={entering} exiting={exiting} style={styles.stepFill}>
              <InterestsStep
                interests={wizard.interests}
                subcategoryPicks={wizard.subcategoryPicks}
                onToggleInterest={wizard.toggleInterest}
                onSetSubcategories={wizard.setSubcategoriesFor}
                onContinue={wizard.advanceToNext}
                onSkip={wizard.advanceToNext}
              />
            </Animated.View>
          )}

          {isBudgetStep && (
            <Animated.View key="step-budget" entering={entering} exiting={exiting} style={styles.stepFill}>
              <BudgetStep
                amount={wizard.budgetAmount}
                onChangeAmount={wizard.setBudgetAmount}
                onContinue={wizard.advanceToNext}
                onSkip={wizard.advanceToNext}
              />
            </Animated.View>
          )}

          {isChatStep && !WIZARD_ONLY && (
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
          </>
          )}

          {/* WIZARD_ONLY: loading overlay tras seleccionar el último step de
            * preferencias. Sustituye al ChatStep como pantalla de generación. */}
          {WIZARD_ONLY && (wizard.loading || wizard.error) && (
            <Animated.View
              key="step-generating"
              entering={FadeIn.duration(300)}
              style={[styles.stepFill, styles.generatingWrap]}
              pointerEvents="auto"
            >
              {wizard.loading && (
                <>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.generatingText}>
                    {t('wizard.generating')}
                  </Text>
                </>
              )}
              {wizard.error && !wizard.loading && (
                <>
                  <Ionicons name="alert-circle-outline" size={48} color="#FFFFFF" />
                  <Text style={styles.generatingError}>{wizard.error}</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={wizard.handleReset}
                    style={styles.retryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Retry"
                  >
                    <Text style={styles.retryBtnText}>{t('wizard.retry')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          )}
        </View>
      </View>
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
  stepFillTop: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 100,
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
  cityContinueWrap: {
    width: '100%',
    marginTop: 20,
  },
  cityContinueBlur: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  cityContinueText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  generatingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  generatingText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  generatingError: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
