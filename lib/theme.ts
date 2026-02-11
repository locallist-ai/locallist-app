/**
 * LocalList Brand Theme
 * Source of truth: LocalList.Landing/css/styles.css (lines 10-21)
 */

export const colors = {
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
  // Derived
  electricBlueLight: '#dbeafe',
  sunsetOrangeLight: '#fff7ed',
} as const;

export const fonts = {
  /** Body text, UI, buttons, navigation */
  body: 'Inter',
  bodyMedium: 'InterMedium',
  bodySemiBold: 'InterSemiBold',
  bodyBold: 'InterBold',
  /** Titles, headings, editorial */
  heading: 'PlayfairDisplay',
  headingSemiBold: 'PlayfairDisplaySemiBold',
  headingBold: 'PlayfairDisplayBold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontFamily: fonts.headingBold,
    fontSize: 32,
    lineHeight: 40,
    color: colors.deepOcean,
  },
  h2: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.deepOcean,
  },
  h3: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.deepOcean,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMain,
  },
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  button: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 24,
  },
} as const;
