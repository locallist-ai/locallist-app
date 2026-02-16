/**
 * Theme variants for A/B testing the home screen look & feel.
 * Each theme overrides color tokens, copy, and visual style — typography and spacing stay the same.
 */

export type ThemeColors = {
  deepOcean: string;
  electricBlue: string;
  sunsetOrange: string;
  paperWhite: string;
  successEmerald: string;
  textMain: string;
  textSecondary: string;
  borderColor: string;
  bgMain: string;
  bgCard: string;
  error: string;
  electricBlueLight: string;
  sunsetOrangeLight: string;
};

export type ThemeCopy = {
  title: string;
  subtitle: string;
  greeting: string;
  inputPlaceholder: string;
  ctaText: string;
};

export type ThemeVisualStyle = {
  layout: 'classic' | 'modern';
  ctaVariant: 'outline' | 'filled';
  ctaFillColor?: string;
  ctaTextColor?: string;
  cardBorderWidth?: number;
  cardBorderColor?: string;
  bubbleStyle: 'tinted' | 'bordered';
  bubbleBorderColor?: string;
};

export type ThemeId = 'original' | 'tech' | 'premium' | 'friendly';

export type ThemeConfig = {
  id: ThemeId;
  label: string;
  dot: string; // color for the switcher dot
  colors: ThemeColors;
  copy: ThemeCopy;
  visualStyle: ThemeVisualStyle;
};

const originalColors: ThemeColors = {
  deepOcean: '#0f172a',
  electricBlue: '#3b82f6',
  sunsetOrange: '#f97316',
  paperWhite: '#F2EFE9',
  successEmerald: '#10b981',
  textMain: '#1e293b',
  textSecondary: '#475569',
  borderColor: '#e2e8f0',
  bgMain: '#F2EFE9',
  bgCard: '#FFFFFF',
  error: '#ef4444',
  electricBlueLight: '#dbeafe',
  sunsetOrangeLight: '#fff7ed',
};

const techColors: ThemeColors = {
  deepOcean: '#0f172a',
  electricBlue: '#0d9488',    // teal primary
  sunsetOrange: '#0891b2',    // cyan accent
  paperWhite: '#F2EFE9',
  successEmerald: '#0d9488',
  textMain: '#1e293b',
  textSecondary: '#475569',
  borderColor: '#d1d5db',
  bgMain: '#F2EFE9',
  bgCard: '#FFFFFF',
  error: '#ef4444',
  electricBlueLight: '#ccfbf1',
  sunsetOrangeLight: '#cffafe',
};

const premiumColors: ThemeColors = {
  deepOcean: '#1c1917',
  electricBlue: '#92400e',    // terracota primary
  sunsetOrange: '#78716c',    // warm gray accent
  paperWhite: '#F2EFE9',
  successEmerald: '#92400e',
  textMain: '#292524',
  textSecondary: '#78716c',
  borderColor: '#d6d3d1',
  bgMain: '#F2EFE9',
  bgCard: '#FAFAF9',          // subtle off-white
  error: '#ef4444',
  electricBlueLight: '#fef3c7',
  sunsetOrangeLight: '#f5f5f4',
};

const friendlyColors: ThemeColors = {
  deepOcean: '#1c1917',
  electricBlue: '#ea580c',    // coral primary
  sunsetOrange: '#16a34a',    // green accent
  paperWhite: '#F2EFE9',
  successEmerald: '#16a34a',
  textMain: '#1e293b',
  textSecondary: '#475569',
  borderColor: '#e2e8f0',
  bgMain: '#F2EFE9',
  bgCard: '#FFFFFF',
  error: '#ef4444',
  electricBlueLight: '#ffedd5',
  sunsetOrangeLight: '#dcfce7',
};

export const themes: Record<ThemeId, ThemeConfig> = {
  original: {
    id: 'original',
    label: 'Original',
    dot: '#3b82f6',
    colors: originalColors,
    copy: {
      title: 'Your trip,\nyour way',
      subtitle: 'Plans built from curated, local knowledge',
      greeting: 'Hey! Tell me about your ideal trip and I\'ll build the perfect plan for you.',
      inputPlaceholder: 'Type here to chat with the AI...',
      ctaText: 'Start your plan',
    },
    visualStyle: {
      layout: 'classic',
      ctaVariant: 'outline',
      bubbleStyle: 'tinted',
    },
  },
  tech: {
    id: 'tech',
    label: 'Tech',
    dot: '#0d9488',
    colors: techColors,
    copy: {
      title: 'Smart plans,\nzero guesswork',
      subtitle: 'Data-driven plans, locally sourced',
      greeting: 'I\'ll match you with curated spots based on your style. What are you looking for?',
      inputPlaceholder: 'Describe your ideal day...',
      ctaText: 'Build my plan',
    },
    visualStyle: {
      layout: 'modern',
      ctaVariant: 'filled',
      ctaFillColor: '#0d9488',
      ctaTextColor: '#FFFFFF',
      cardBorderWidth: 1,
      cardBorderColor: '#d1d5db',
      bubbleStyle: 'bordered',
      bubbleBorderColor: '#d1d5db',
    },
  },
  premium: {
    id: 'premium',
    label: 'Premium',
    dot: '#92400e',
    colors: premiumColors,
    copy: {
      title: 'Curated for you.\nOnly the best.',
      subtitle: 'Every recommendation, personally vetted',
      greeting: 'Welcome. Share your travel preferences and I\'ll curate a plan worthy of your time.',
      inputPlaceholder: 'Tell me about your perfect trip...',
      ctaText: 'Curate my plan',
    },
    visualStyle: {
      layout: 'modern',
      ctaVariant: 'outline',
      bubbleStyle: 'tinted',
    },
  },
  friendly: {
    id: 'friendly',
    label: 'Friendly',
    dot: '#ea580c',
    colors: friendlyColors,
    copy: {
      title: 'Let\'s plan\nsomething great',
      subtitle: 'Your insider guide to the best spots',
      greeting: 'Hey there! I know the best spots in town. Tell me what you\'re in the mood for!',
      inputPlaceholder: 'I\'m looking for...',
      ctaText: 'Let\'s go!',
    },
    visualStyle: {
      layout: 'modern',
      ctaVariant: 'filled',
      ctaFillColor: '#ea580c',
      ctaTextColor: '#FFFFFF',
      bubbleStyle: 'tinted',
    },
  },
};

export const themeOrder: ThemeId[] = ['original', 'tech', 'premium', 'friendly'];
