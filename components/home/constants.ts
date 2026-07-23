import { ImageSourcePropType, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type en from '../../lib/i18n/en';
export type { City } from '../../lib/cities';
export { CITIES } from '../../lib/cities';

// ── i18n helper type ──

/** Flatten nested keys from the translation file into dot-notation union */
type FlatKeys<T, Prefix extends string = ''> = T extends Record<string, unknown>
  ? { [K in keyof T & string]: FlatKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`> }[keyof T & string]
  : Prefix;

export type TKeys = FlatKeys<typeof en>;

// ── Domain types ──

export interface StepOption {
  id: string;
  icon: ImageSourcePropType;
  labelKey: TKeys;
  emoji: string;
  /** Mockup 2026-04-25: icono branded MCI que sustituye al emoji en el chip
   *  cuando se renderiza vía ChoiceChip o InterestsStep. Si está ausente,
   *  el chip cae al emoji unicode legacy. */
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export interface WizardStepConfig {
  titleKey: TKeys;
  subtitleKey: TKeys;
  options: StepOption[];
}

// ── Step option data ──

export const DURATION_OPTIONS: StepOption[] = [
  { id: '1', icon: require('../../assets/images/icon_1day.png'), labelKey: 'wizard.duration1Day', emoji: '☀️', iconName: 'numeric-1-circle-outline' },
  { id: '2', icon: require('../../assets/images/icon_3days.png'), labelKey: 'wizard.duration2Days', emoji: '\u{1F338}', iconName: 'numeric-2-circle-outline' },
  { id: '3', icon: require('../../assets/images/icon_3days.png'), labelKey: 'wizard.duration3Days', emoji: '\u{1F33C}', iconName: 'numeric-3-circle-outline' },
];

// Trip-duration caps, mirrored from the backend Plus gate (api-net):
// free accounts top out at 3 days; Plus unlocks up to 14. `daysFromDuration`
// clamps to these, and DurationStep offers day pills up to the tier's cap
// (free users see 4-14 as a locked upsell affordance).
export const FREE_MAX_DAYS = 3;
export const PLUS_MAX_DAYS = 14;
export const maxDaysForTier = (isPro: boolean): number => (isPro ? PLUS_MAX_DAYS : FREE_MAX_DAYS);

export const COMPANY_OPTIONS: StepOption[] = [
  { id: 'solo', icon: require('../../assets/images/icon_solo.png'), labelKey: 'wizard.companySolo', emoji: '\u{1F9D1}', iconName: 'account' },
  { id: 'couple', icon: require('../../assets/images/icon_couple.png'), labelKey: 'wizard.companyCouple', emoji: '❤️', iconName: 'account-heart' },
  { id: 'family', icon: require('../../assets/images/icon_family.png'), labelKey: 'wizard.companyFamily', emoji: '\u{1F46A}', iconName: 'account-group' },
  { id: 'friends', icon: require('../../assets/images/icon_solo.png'), labelKey: 'wizard.companyFriends', emoji: '\u{1F46B}', iconName: 'account-multiple' },
];

// Top-level interests (multi-select). Cuando el usuario tap una de estas, abre
// un sheet de subcategorías para profundizar (sushi/italian dentro de food, etc).
// El icon es legacy del StepOption type — ChoiceChip solo renderiza emoji.
export const INTEREST_OPTIONS: StepOption[] = [
  { id: 'food', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestFood', emoji: '\u{1F37D}️', iconName: 'silverware-fork-knife' },
  { id: 'outdoors', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestOutdoors', emoji: '\u{1F332}', iconName: 'pine-tree' },
  { id: 'coffee', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestCoffee', emoji: '☕', iconName: 'coffee' },
  { id: 'culture', icon: require('../../assets/images/icon_cultural.png'), labelKey: 'wizard.interestCulture', emoji: '\u{1F3A8}', iconName: 'bank-outline' },
  { id: 'nightlife', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestNightlife', emoji: '\u{1F378}', iconName: 'glass-cocktail' },
  { id: 'wellness', icon: require('../../assets/images/icon_relax.png'), labelKey: 'wizard.interestWellness', emoji: '\u{1F9D8}', iconName: 'spa-outline' },
  { id: 'shopping', icon: require('../../assets/images/icon_adventure.png'), labelKey: 'wizard.interestShopping', emoji: '\u{1F6CD}️', iconName: 'shopping-outline' },
];

export interface SubcategoryOption {
  id: string;
  label: string;
  emoji: string;
  /** Branded MCI glyph para el chip (paperWhite bubble + sunsetOrange icon). */
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
}

// Sub-categorías por interest top-level. Los `id` son tags lowercase que el
// backend mapea contra Place.Subcategory mediante substring match (ver memoria
// project_real_routing_pending para cómo evolucionará el matcher). Lista
// derivada del audit del catálogo Miami real (45 places, 37 subcategorías).
export const SUBCATEGORIES_BY_INTEREST: Record<string, SubcategoryOption[]> = {
  food: [
    { id: 'ramen', label: 'Ramen', emoji: '\u{1F35C}', iconName: 'noodles' },
    { id: 'sushi', label: 'Sushi', emoji: '\u{1F363}', iconName: 'fish' },
    { id: 'italian', label: 'Italian', emoji: '\u{1F35D}', iconName: 'pasta' },
    { id: 'pizza', label: 'Pizza', emoji: '\u{1F355}', iconName: 'pizza' },
    { id: 'mexican', label: 'Mexican', emoji: '\u{1F32E}', iconName: 'taco' },
    { id: 'tacos', label: 'Tacos', emoji: '\u{1F32E}', iconName: 'taco' },
    { id: 'cuban', label: 'Cuban', emoji: '\u{1F1E8}\u{1F1FA}', iconName: 'food-variant' },
    { id: 'latin', label: 'Latin American', emoji: '\u{1F30D}', iconName: 'food-variant' },
    { id: 'american', label: 'American', emoji: '\u{1F354}', iconName: 'hamburger' },
    { id: 'steakhouse', label: 'Steakhouse', emoji: '\u{1F969}', iconName: 'food-steak' },
    { id: 'seafood', label: 'Seafood', emoji: '\u{1F990}', iconName: 'fish' },
    { id: 'mediterranean', label: 'Mediterranean', emoji: '\u{1FAD2}', iconName: 'food-variant' },
    { id: 'asian', label: 'Asian Fusion', emoji: '\u{1F961}', iconName: 'bowl-mix-outline' },
    { id: 'brunch', label: 'Brunch', emoji: '\u{1F95E}', iconName: 'egg-fried' },
    { id: 'bakery', label: 'Bakery', emoji: '\u{1F950}', iconName: 'baguette' },
    { id: 'vegan', label: 'Vegan', emoji: '\u{1F96C}', iconName: 'leaf' },
  ],
  nightlife: [
    { id: 'pub', label: 'Pub', emoji: '\u{1F37A}', iconName: 'beer' },
    { id: 'cocktail', label: 'Cocktail Bar', emoji: '\u{1F378}', iconName: 'glass-cocktail' },
    { id: 'speakeasy', label: 'Speakeasy', emoji: '\u{1F943}', iconName: 'glass-tulip' },
    { id: 'rooftop', label: 'Rooftop Bar', emoji: '\u{1F306}', iconName: 'city-variant-outline' },
    { id: 'wine', label: 'Wine Bar', emoji: '\u{1F377}', iconName: 'glass-wine' },
    { id: 'sports', label: 'Sports Bar', emoji: '\u{1F3C6}', iconName: 'trophy-outline' },
    { id: 'beer', label: 'Beer Bar', emoji: '\u{1F37A}', iconName: 'beer-outline' },
    { id: 'nightclub', label: 'Nightclub', emoji: '\u{1FA70}', iconName: 'music-note' },
    { id: 'live music', label: 'Live Music', emoji: '\u{1F3B6}', iconName: 'music' },
  ],
  coffee: [
    { id: 'specialty', label: 'Specialty Coffee', emoji: '☕', iconName: 'coffee-outline' },
    { id: 'espresso', label: 'Espresso Bar', emoji: '\u{2615}', iconName: 'coffee' },
    { id: 'bakery', label: 'Bakery Café', emoji: '\u{1F950}', iconName: 'baguette' },
    { id: 'tea', label: 'Tea House', emoji: '\u{1F375}', iconName: 'tea-outline' },
    { id: 'juice', label: 'Juice Bar', emoji: '\u{1F9C3}', iconName: 'cup-water' },
    { id: 'dessert', label: 'Dessert', emoji: '\u{1F370}', iconName: 'cupcake' },
  ],
  outdoors: [
    { id: 'beach', label: 'Beach', emoji: '\u{1F3D6}️', iconName: 'beach' },
    { id: 'park', label: 'Park', emoji: '\u{1F333}', iconName: 'tree-outline' },
    { id: 'garden', label: 'Garden', emoji: '\u{1F33A}', iconName: 'flower-outline' },
    { id: 'trail', label: 'Trail', emoji: '\u{1F97E}', iconName: 'hiking' },
    { id: 'marina', label: 'Marina', emoji: '\u{2693}', iconName: 'anchor' },
    { id: 'pier', label: 'Pier', emoji: '\u{1F30A}', iconName: 'waves' },
    { id: 'waterfront', label: 'Waterfront', emoji: '\u{1F305}', iconName: 'water' },
    { id: 'dog', label: 'Dog Park', emoji: '\u{1F415}', iconName: 'dog' },
  ],
  wellness: [
    { id: 'spa', label: 'Spa', emoji: '\u{1F9D6}', iconName: 'spa-outline' },
    { id: 'pilates', label: 'Pilates', emoji: '\u{1F938}', iconName: 'yoga' },
    { id: 'yoga', label: 'Yoga', emoji: '\u{1F9D8}', iconName: 'human-handsdown' },
    { id: 'gym', label: 'Gym', emoji: '\u{1F4AA}', iconName: 'dumbbell' },
    { id: 'sauna', label: 'Sauna', emoji: '\u{1F9FC}', iconName: 'heat-wave' },
    { id: 'iv', label: 'IV Therapy', emoji: '\u{1F489}', iconName: 'needle' },
    { id: 'massage', label: 'Massage', emoji: '\u{1F485}', iconName: 'hand-heart-outline' },
    { id: 'salt', label: 'Salt Cave', emoji: '\u{1F9C2}', iconName: 'diamond-outline' },
  ],
  culture: [
    { id: 'museum', label: 'Museum', emoji: '\u{1F3DB}️', iconName: 'bank-outline' },
    { id: 'gallery', label: 'Gallery', emoji: '\u{1F5BC}️', iconName: 'image-frame' },
    { id: 'theater', label: 'Theater', emoji: '\u{1F3AD}', iconName: 'theater' },
    { id: 'music', label: 'Music Venue', emoji: '\u{1F3B5}', iconName: 'music' },
    { id: 'festival', label: 'Festival Site', emoji: '\u{1F3AA}', iconName: 'party-popper' },
    { id: 'historic', label: 'Historic Site', emoji: '\u{1F3F0}', iconName: 'castle' },
    { id: 'art', label: 'Public Art', emoji: '\u{1F3A8}', iconName: 'palette-outline' },
    { id: 'cultural', label: 'Cultural Center', emoji: '\u{1F30F}', iconName: 'earth' },
  ],
  shopping: [
    { id: 'boutique', label: 'Boutique', emoji: '\u{1F457}', iconName: 'hanger' },
    { id: 'vintage', label: 'Vintage', emoji: '\u{1F570}️', iconName: 'clock-time-eight-outline' },
    { id: 'bookstore', label: 'Bookstore', emoji: '\u{1F4DA}', iconName: 'bookshelf' },
    { id: 'record', label: 'Record Store', emoji: '\u{1F4BF}', iconName: 'disc' },
    { id: 'concept', label: 'Concept Store', emoji: '\u{1F6CD}️', iconName: 'shopping-outline' },
    { id: 'market', label: 'Market', emoji: '\u{1F6D2}', iconName: 'cart-outline' },
    { id: 'florist', label: 'Florist', emoji: '\u{1F490}', iconName: 'flower-tulip-outline' },
    { id: 'designer', label: 'Designer', emoji: '\u{1F45C}', iconName: 'bag-personal-outline' },
  ],
};

export const BUDGET_OPTIONS: StepOption[] = [
  { id: 'budget', icon: require('../../assets/images/icon_budget.png'), labelKey: 'wizard.budgetBudget', emoji: '\u{1F4B0}', iconName: 'cash' },
  { id: 'moderate', icon: require('../../assets/images/icon_moderate.png'), labelKey: 'wizard.budgetModerate', emoji: '\u{1F4B3}', iconName: 'credit-card-outline' },
  { id: 'premium', icon: require('../../assets/images/icon_premium.png'), labelKey: 'wizard.budgetPremium', emoji: '\u{1F451}', iconName: 'crown-outline' },
];

// Pesos USD/día/persona asignados a cada tier preset. Pablo 2026-04-25:
// "en vez de 3 tabs, deberíamos dejar que el usuario ponga su presupuesto"
// — el step ahora es input libre con estos presets como atajos.
export const BUDGET_AMOUNT_PRESETS: Record<string, number> = {
  budget: 50,
  moderate: 150,
  premium: 300,
};

/** Deriva tier ('budget'|'moderate'|'premium') desde un amount USD/día. */
export const tierFromBudgetAmount = (amount: number): 'budget' | 'moderate' | 'premium' => {
  if (amount < 80) return 'budget';
  if (amount < 200) return 'moderate';
  return 'premium';
};

export const STEPS: WizardStepConfig[] = [
  { titleKey: 'wizard.step1Title', subtitleKey: 'wizard.step1Subtitle', options: DURATION_OPTIONS },
  { titleKey: 'wizard.step2Title', subtitleKey: 'wizard.step2Subtitle', options: COMPANY_OPTIONS },
  // STEPS[2] = interests (multi-select con drill-down). El config aquí es un
  // marker — el render de InterestsStep es manejado aparte en HomeV2; el title/
  // subtitle se usa solo si en algún momento se cae al render fallback.
  { titleKey: 'wizard.stepInterestsTitle', subtitleKey: 'wizard.stepInterestsSubtitle', options: INTEREST_OPTIONS },
  { titleKey: 'wizard.step4Title', subtitleKey: 'wizard.step4Subtitle', options: BUDGET_OPTIONS },
];

/** Index de la step de interests dentro de STEPS (= step de wizard - 1). */
export const INTERESTS_STEP_INDEX_IN_STEPS = 2;

// Sub-options para company step (drill-down). Pablo 2026-04-25: cada step
// del wizard puede llevar a un menú de refinamiento. Aquí, al picar un parent
// (solo/couple/family), abre un sheet con tags adicionales que matchean con
// Place.suitableFor / bestFor en el catálogo.
export const COMPANY_SUBCATEGORIES: Record<string, SubcategoryOption[]> = {
  solo: [
    { id: 'backpacker', label: 'Backpacker', emoji: '\u{1F392}', iconName: 'bag-personal-outline' },
    { id: 'digital-nomad', label: 'Digital nomad', emoji: '\u{1F4BB}', iconName: 'laptop' },
    { id: 'business', label: 'Business', emoji: '\u{1F454}', iconName: 'briefcase-outline' },
    { id: 'social', label: 'Social', emoji: '\u{1F4AC}', iconName: 'message-text-outline' },
  ],
  couple: [
    { id: 'honeymoon', label: 'Honeymoon', emoji: '\u{1F48D}', iconName: 'ring' },
    { id: 'dating', label: 'Dating', emoji: '\u{1F378}', iconName: 'heart-outline' },
    { id: 'anniversary', label: 'Anniversary', emoji: '\u{1F381}', iconName: 'gift-outline' },
  ],
  family: [
    { id: 'with-kids', label: 'With kids', emoji: '\u{1F9D2}', iconName: 'human-child' },
    { id: 'with-teens', label: 'With teens', emoji: '\u{1F3AE}', iconName: 'gamepad-variant-outline' },
    { id: 'multi-gen', label: 'Multi-gen', emoji: '\u{1F46A}', iconName: 'account-group-outline' },
  ],
  friends: [
    { id: 'bachelor', label: 'Bachelor', emoji: '\u{1F37A}', iconName: 'beer-outline' },
    { id: 'bachelorette', label: 'Bachelorette', emoji: '\u{1F478}', iconName: 'crown-outline' },
    { id: 'group-trip', label: 'Group trip', emoji: '\u{1F46B}', iconName: 'account-multiple-outline' },
    { id: 'birthday', label: 'Birthday', emoji: '\u{1F389}', iconName: 'cake-variant-outline' },
  ],
};

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

/** Total number of progress dots — 4 prefs (city is a separate pre-step). */
export const TOTAL_STEPS = WIZARD_ONLY ? 4 : 5;

/** Última step index del flujo interactivo (después → generar). step=4 = budget. */
export const LAST_STEP_INDEX = WIZARD_ONLY ? 4 : 5;
