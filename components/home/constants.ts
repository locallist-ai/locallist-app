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

// Top-level interests (multi-select). Cuando el usuario tap una de estas, abre
// un sheet de subcategorías para profundizar (sushi/italian dentro de food, etc).
// El icon es legacy del StepOption type — ChoiceChip solo renderiza emoji.
export const INTEREST_OPTIONS: StepOption[] = [
  { id: 'food', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestFood', emoji: '\u{1F37D}\uFE0F' },
  { id: 'outdoors', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestOutdoors', emoji: '\u{1F332}' },
  { id: 'coffee', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestCoffee', emoji: '\u2615' },
  { id: 'culture', icon: require('../../assets/images/icon_cultural.png'), labelKey: 'wizard.interestCulture', emoji: '\u{1F3A8}' },
  { id: 'nightlife', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestNightlife', emoji: '\u{1F378}' },
  { id: 'wellness', icon: require('../../assets/images/icon_relax.png'), labelKey: 'wizard.interestWellness', emoji: '\u{1F9D8}' },
];

export interface SubcategoryOption {
  id: string;
  label: string;
  emoji: string;
}

// Sub-categorías por interest top-level. Los `id` son tags lowercase que el
// backend mapea contra Place.Subcategory mediante substring match (ver memoria
// project_real_routing_pending para cómo evolucionará el matcher). Lista
// derivada del audit del catálogo Miami real (45 places, 37 subcategorías).
export const SUBCATEGORIES_BY_INTEREST: Record<string, SubcategoryOption[]> = {
  food: [
    { id: 'sushi', label: 'Sushi', emoji: '\u{1F363}' },
    { id: 'italian', label: 'Italian', emoji: '\u{1F35D}' },
    { id: 'mexican', label: 'Mexican', emoji: '\u{1F32E}' },
    { id: 'thai', label: 'Thai', emoji: '\u{1F35C}' },
    { id: 'cuban', label: 'Cuban', emoji: '\u{1F1E8}\u{1F1FA}' },
    { id: 'seafood', label: 'Seafood', emoji: '\u{1F990}' },
    { id: 'asian', label: 'Asian', emoji: '\u{1F961}' },
  ],
  outdoors: [
    { id: 'beach', label: 'Beach', emoji: '\u{1F3D6}\uFE0F' },
    { id: 'park', label: 'Parks', emoji: '\u{1F333}' },
    { id: 'garden', label: 'Gardens', emoji: '\u{1F33A}' },
    { id: 'trail', label: 'Trails', emoji: '\u{1F97E}' },
  ],
  coffee: [
    { id: 'specialty', label: 'Specialty', emoji: '\u2615' },
    { id: 'bakery', label: 'Bakery', emoji: '\u{1F950}' },
    { id: 'dessert', label: 'Dessert', emoji: '\u{1F370}' },
  ],
  culture: [
    { id: 'museum', label: 'Museums', emoji: '\u{1F3DB}\uFE0F' },
    { id: 'festival', label: 'Festivals', emoji: '\u{1F3AA}' },
    { id: 'art', label: 'Art', emoji: '\u{1F3A8}' },
  ],
  nightlife: [
    { id: 'speakeasy', label: 'Speakeasy', emoji: '\u{1F943}' },
    { id: 'wine', label: 'Wine bar', emoji: '\u{1F377}' },
    { id: 'cocktails', label: 'Cocktails', emoji: '\u{1F378}' },
  ],
  wellness: [
    { id: 'spa', label: 'Spa', emoji: '\u{1F9D6}' },
    { id: 'pilates', label: 'Pilates', emoji: '\u{1F938}' },
    { id: 'iv', label: 'IV therapy', emoji: '\u{1F489}' },
  ],
};

export const BUDGET_OPTIONS: StepOption[] = [
  { id: 'budget', icon: require('../../assets/images/icon_budget.png'), labelKey: 'wizard.budgetBudget', emoji: '\u{1F4B0}' },
  { id: 'moderate', icon: require('../../assets/images/icon_moderate.png'), labelKey: 'wizard.budgetModerate', emoji: '\u{1F4B3}' },
  { id: 'premium', icon: require('../../assets/images/icon_premium.png'), labelKey: 'wizard.budgetPremium', emoji: '\u{1F451}' },
];

export const STEPS: WizardStepConfig[] = [
  { titleKey: 'wizard.step1Title', subtitleKey: 'wizard.step1Subtitle', options: DURATION_OPTIONS },
  { titleKey: 'wizard.step2Title', subtitleKey: 'wizard.step2Subtitle', options: COMPANY_OPTIONS },
  { titleKey: 'wizard.step3Title', subtitleKey: 'wizard.step3Subtitle', options: STYLE_OPTIONS },
  // STEPS[3] = interests (multi-select con drill-down). El config aquí es un
  // marker — el render de InterestsStep es manejado aparte en HomeV2; el title/
  // subtitle se usa solo si en algún momento se cae al render fallback.
  { titleKey: 'wizard.stepInterestsTitle', subtitleKey: 'wizard.stepInterestsSubtitle', options: INTEREST_OPTIONS },
  { titleKey: 'wizard.step4Title', subtitleKey: 'wizard.step4Subtitle', options: BUDGET_OPTIONS },
];

/** Index de la step de interests dentro de STEPS (= step de wizard - 1). */
export const INTERESTS_STEP_INDEX_IN_STEPS = 3;

// ── Helpers ──

export const hapticSelect = (): void => {
  if (Platform.OS === 'ios') Haptics.selectionAsync();
};

export const hapticImpact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void => {
  if (Platform.OS === 'ios') Haptics.impactAsync(style);
};

/**
 * Feature flag — solo wizard, sin chat concatenado.
 *
 * Pablo (2026-04-25): "vamos a quitar el chat. No elimines el codigo, pero por
 * ahora vamos a mantener solo el wizard, no queremos concatenarlos ya. En el
 * futuro, los usuarios podrán construir sus planes desde el wizard o hablar
 * directamente en un chat conversacional, pero serán features y flows
 * completamente diferentes."
 *
 * Mientras este flag sea true:
 *   - El wizard salta directamente del último step de preferencias a generar.
 *   - El componente ChatStep + el estado `message` + el `useEffect` del bubble
 *     siguen vivos en el código pero no son alcanzables desde la UI.
 *   - El payload sigue mandando `message: ''` (backend lo acepta como nullable).
 *
 * Para reactivar el chat: setear a false (o eliminar el flag) y la UI vuelve.
 */
export const WIZARD_ONLY = true;

/** Total number of progress dots — city + 5 prefs (incluye interests). */
export const TOTAL_STEPS = WIZARD_ONLY ? 6 : 7;

/** Última step index del flujo interactivo (después → generar). step=5 = budget. */
export const LAST_STEP_INDEX = WIZARD_ONLY ? 5 : 6;
