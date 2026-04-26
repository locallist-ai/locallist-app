import React, { useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts, colors, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import {
  BUDGET_OPTIONS,
  BUDGET_AMOUNT_PRESETS,
  tierFromBudgetAmount,
  type StepOption,
} from './constants';

// Step de budget — input numérico custom + presets + tier badge live.
// Reemplaza al chip-only step anterior. Pablo 2026-04-25: "en vez de 3 tabs,
// deberíamos dejar que el usuario ponga su presupuesto."

interface BudgetStepProps {
  amount: number | null;
  onChangeAmount: (n: number | null) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export const BudgetStep: React.FC<BudgetStepProps> = ({
  amount,
  onChangeAmount,
  onContinue,
  onSkip,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const tier = useMemo(
    () => (amount && amount > 0 ? tierFromBudgetAmount(amount) : null),
    [amount],
  );

  const handleInputChange = (text: string) => {
    // Limpia todo lo que no sea dígito (ignora $, comas, puntos).
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      onChangeAmount(null);
      return;
    }
    const n = parseInt(cleaned, 10);
    if (Number.isFinite(n)) onChangeAmount(Math.min(n, 9999));
  };

  const handlePreset = (preset: StepOption) => {
    const presetAmount = BUDGET_AMOUNT_PRESETS[preset.id];
    if (presetAmount != null) onChangeAmount(presetAmount);
  };

  const inputValue = amount != null ? String(amount) : '';
  const hasValue = amount != null && amount > 0;
  const ctaLabel = hasValue ? t('wizard.interestContinue') : t('wizard.skip');

  return (
    <View style={styles.container}>
      <EditorialTitle
        text={t('wizard.stepBudgetAmountTitle')}
        size="md"
        color="#FFFFFF"
        withShadow
        style={styles.titleSpacing}
      />
      <StepSubtitle
        text={t('wizard.stepBudgetAmountSubtitle')}
        size="md"
        color="rgba(255, 255, 255, 0.7)"
        withShadow
        style={styles.subtitleSpacing}
      />

      <View style={styles.inputCardWrap}>
        <View style={styles.inputCard}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            value={inputValue}
            onChangeText={handleInputChange}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.35)"
            maxLength={4}
            style={styles.input}
            accessibilityLabel={t('wizard.stepBudgetAmountTitle')}
          />
        </View>
      </View>

      {tier && (
        <View style={styles.tierBadge}>
          <Text style={styles.tierBadgeText}>{t(`wizard.budgetTier_${tier}`)}</Text>
        </View>
      )}

      <View style={styles.presetsRow}>
        {BUDGET_OPTIONS.map((opt) => {
          const presetAmount = BUDGET_AMOUNT_PRESETS[opt.id];
          const isActive = amount === presetAmount;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.85}
              onPress={() => handlePreset(opt)}
              style={[styles.presetChip, isActive && styles.presetChipActive]}
              accessibilityRole="button"
              accessibilityLabel={`${t(opt.labelKey)} $${presetAmount}`}
            >
              {opt.iconName ? (
                <View style={[styles.presetIconBubble, isActive && styles.presetIconBubbleActive]}>
                  <MaterialCommunityIcons
                    name={opt.iconName}
                    size={16}
                    color={isActive ? '#FFFFFF' : colors.sunsetOrange}
                  />
                </View>
              ) : (
                <Text style={styles.presetEmoji}>{opt.emoji}</Text>
              )}
              <View style={styles.presetTextWrap}>
                <Text style={styles.presetLabel}>{t(opt.labelKey)}</Text>
                <Text style={styles.presetAmount}>${presetAmount}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={hasValue ? onContinue : onSkip}
          style={styles.continueBtn}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <BlurView intensity={60} tint="light" style={styles.continueBlur}>
            <Text style={styles.continueText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSpacing: {
    marginBottom: 8,
  },
  subtitleSpacing: {
    marginBottom: 28,
  },
  inputCardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 8,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    minWidth: 200,
  },
  currencyPrefix: {
    fontFamily: fonts.headingBold,
    fontSize: 36,
    color: 'rgba(255,255,255,0.65)',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  input: {
    fontFamily: fonts.headingBold,
    fontSize: 56,
    lineHeight: 64,
    color: '#FFFFFF',
    textAlign: 'left',
    minWidth: 120,
    paddingVertical: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tierBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.28)',
    borderWidth: 1,
    borderColor: colors.sunsetOrange,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginTop: 6,
  },
  tierBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 32,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  presetChipActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.28)',
    borderColor: colors.sunsetOrange,
  },
  presetEmoji: {
    fontSize: 18,
  },
  presetIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  presetIconBubbleActive: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  presetTextWrap: {
    alignItems: 'flex-start',
  },
  presetLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  presetAmount: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  bottomActions: {
    marginTop: 28,
  },
  continueBtn: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBlur: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  continueText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
