import { ImageSourcePropType, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type en from '../../lib/i18n/en';

// ── i18n helper type ──

/** Flatten nested keys from the translation file into dot-notation union */
type FlatKeys<T, Prefix extends string = ''> = T extends Record<string, unknown>
  ? { [K in keyof T & string]: FlatKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`> }[keyof T & string]
  : Prefix;

export type TKeys = FlatKeys<typeof en>;

// ── Domain types ──

export interface City {
  name: string;
  emoji: string;
  color: string;
}

export interface StepOption {
  id: string;
  icon: ImageSourcePropType;
  labelKey: TKeys;
  emoji: string;
}

export interface WizardStepConfig {
  titleKey: TKeys;
  subtitleKey: TKeys;
  options: StepOption[];
}

// ── City data ──

export const CITIES: City[] = [
  { name: 'Miami', emoji: '\u{1F334}', color: '#f97316' },
];

// ── Step option data ──

export const DURATION_OPTIONS: StepOption[] = [
  { id: '1', icon: require('../../assets/images/icon_1day.png'), labelKey: 'wizard.duration1Day', emoji: '\u2600\uFE0F' },
  { id: '2', icon: require('../../assets/images/icon_3days.png'), labelKey: 'wizard.duration2Days', emoji: '\u{1F338}' },
  { id: '3', icon: require('../../assets/images/icon_3days.png'), labelKey: 'wizard.duration3Days', emoji: '\u{1F33C}' },
];

export const COMPANY_OPTIONS: StepOption[] = [
  { id: 'solo', icon: require('../../assets/images/icon_solo.png'), labelKey: 'wizard.companySolo', emoji: '\u{1F9D1}' },
  { id: 'couple', icon: require('../../assets/images/icon_couple.png'), labelKey: 'wizard.companyCouple', emoji: '\u2764\uFE0F' },
  { id: 'family', icon: require('../../assets/images/icon_family.png'), labelKey: 'wizard.companyFamily', emoji: '\u{1F46A}' },
];

export const STYLE_OPTIONS: StepOption[] = [
  { id: 'adventure', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.styleAdventure', emoji: '\u{1F9ED}' },
  { id: 'relax', icon: require('../../assets/images/icon_relax.png'), labelKey: 'wizard.styleRelax', emoji: '\u{1F33F}' },
  { id: 'cultural', icon: require('../../assets/images/icon_cultural.png'), labelKey: 'wizard.styleCultural', emoji: '\u{1F3A8}' },
];

export const BUDGET_OPTIONS: StepOption[] = [
  { id: 'budget', icon: require('../../assets/images/icon_budget.png'), labelKey: 'wizard.budgetBudget', emoji: '\u{1F4B0}' },
  { id: 'moderate', icon: require('../../assets/images/icon_moderate.png'), labelKey: 'wizard.budgetModerate', emoji: '\u{1F4B3}' },
  { id: 'premium', icon: require('../../assets/images/icon_premium.png'), labelKey: 'wizard.budgetPremium', emoji: '\u{1F451}' },
];

export const STEPS: WizardStepConfig[] = [
  { titleKey: 'wizard.step1Title', subtitleKey: 'wizard.step1Subtitle', options: DURATION_OPTIONS },
  { titleKey: 'wizard.step2Title', subtitleKey: 'wizard.step2Subtitle', options: COMPANY_OPTIONS },
  { titleKey: 'wizard.step3Title', subtitleKey: 'wizard.step3Subtitle', options: STYLE_OPTIONS },
  { titleKey: 'wizard.step4Title', subtitleKey: 'wizard.step4Subtitle', options: BUDGET_OPTIONS },
];

// ── Helpers ──

export const hapticSelect = (): void => {
  if (Platform.OS === 'ios') Haptics.selectionAsync();
};

export const hapticImpact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void => {
  if (Platform.OS === 'ios') Haptics.impactAsync(style);
};

/** Total number of wizard steps (city + 4 preferences + chat) */
export const TOTAL_STEPS = 6;
