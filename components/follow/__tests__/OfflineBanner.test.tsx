/**
 * `OfflineBanner`: pill de conectividad en tiempo real de Follow Mode.
 *  - Renderiza el aviso (i18n EN + ES) SOLO cuando `isOffline`.
 *  - Con conexión no pinta nada (no bloqueante, no molesto).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';
import { OfflineBanner } from '../OfflineBanner';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  i18next.changeLanguage('en');
});

it('con isOffline pinta el aviso de "sin conexión"', () => {
  render(<OfflineBanner isOffline />);
  expect(screen.getByText(en.follow.offlineLive)).toBeTruthy();
});

it('con conexión (isOffline false) no renderiza nada', () => {
  render(<OfflineBanner isOffline={false} />);
  expect(screen.queryByText(en.follow.offlineLive)).toBeNull();
});

it('respeta el idioma (ES)', async () => {
  await i18next.changeLanguage('es');
  render(<OfflineBanner isOffline />);
  expect(screen.getByText(es.follow.offlineLive)).toBeTruthy();
});
