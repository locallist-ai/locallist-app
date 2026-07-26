/**
 * Spot-check del barrido i18n de accessibilityLabels: los labels de lector de
 * pantalla salen del catálogo i18n (no hardcodeados) y cambian con el idioma.
 * Usa una instancia real de i18next con los recursos en/es del proyecto, así
 * que `useTranslation()` en los componentes resuelve traducciones de verdad.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../lib/i18n/en';
import es from '../../lib/i18n/es';
import { ProgressDots } from '../ui/design-system/ProgressDots';
import { TypingDots } from '../home/TypingDots';

// Mock de reanimated (ambos componentes animan con él).
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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

describe('a11y labels i18n (ingles)', () => {
  it('ProgressDots interpola "Step X of Y" y TypingDots dice "Loading"', async () => {
    await i18next.changeLanguage('en');
    render(
      <>
        <ProgressDots current={1} total={4} />
        <TypingDots />
      </>,
    );
    expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });
});

describe('a11y labels i18n (espanol)', () => {
  it('ProgressDots interpola "Paso X de Y" y TypingDots dice "Cargando"', async () => {
    await i18next.changeLanguage('es');
    render(
      <>
        <ProgressDots current={1} total={4} />
        <TypingDots />
      </>,
    );
    expect(screen.getByLabelText('Paso 2 de 4')).toBeTruthy();
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    // Y ya no aparece el texto inglés hardcodeado.
    expect(screen.queryByLabelText('Step 2 of 4')).toBeNull();
    expect(screen.queryByLabelText('Loading')).toBeNull();
  });
});
