/**
 * SubcategorySheet + i18n real: el cableado `t(opt.labelKey)` de los company
 * subs pinta español con la app en ES e inglés en EN, y las opciones SIN
 * labelKey (subcategorías de interés, ya localizadas vía taxonomía) renderizan
 * su `label` tal cual.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';
import { SubcategorySheet } from '../SubcategorySheet';
import { COMPANY_SUBCATEGORIES } from '../constants';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = { duration: () => chain, easing: () => chain, delay: () => chain };
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain,
    FadeOut: chain,
    SlideInDown: chain,
    SlideOutDown: chain,
    Easing: { out: () => ({}), in: () => ({}), cubic: {} },
  };
});
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

afterEach(async () => {
  await i18next.changeLanguage('en');
});

const renderSheet = (options = COMPANY_SUBCATEGORIES.family) =>
  render(
    <SubcategorySheet
      visible
      parentLabel="Family"
      options={options}
      initialSelected={[]}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      mode="single"
    />,
  );

// El overlay del sheet lleva `accessibilityElementsHidden` (el Pressable de
// backdrop), y RNTL excluye por defecto el subárbol oculto para a11y. Las
// queries necesitan includeHiddenElements para ver el contenido del sheet.
const q = { includeHiddenElements: true } as const;

describe('SubcategorySheet company subs (i18n real)', () => {
  it('con app en ES pinta los labels en español', async () => {
    await i18next.changeLanguage('es');
    renderSheet();
    expect(screen.getByText('Con niños', q)).toBeTruthy();
    expect(screen.getByText('Con adolescentes', q)).toBeTruthy();
    expect(screen.getByText('Multigeneracional', q)).toBeTruthy();
    expect(screen.queryByText('With kids', q)).toBeNull();
  });

  it('con app en EN pinta los labels en inglés', async () => {
    await i18next.changeLanguage('en');
    renderSheet();
    expect(screen.getByText('With kids', q)).toBeTruthy();
    expect(screen.getByText('With teens', q)).toBeTruthy();
    expect(screen.queryByText('Con niños', q)).toBeNull();
  });

  it('opciones sin labelKey (interés, ya localizadas) renderizan su label tal cual', async () => {
    await i18next.changeLanguage('es');
    renderSheet([{ id: 'bakery', label: 'Café Panadería', emoji: '\u{1F950}' }]);
    expect(screen.getByText('Café Panadería', q)).toBeTruthy();
  });
});
