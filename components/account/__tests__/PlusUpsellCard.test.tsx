/**
 * Gating del paywall desde la pantalla Account:
 *  - El CTA del upsell abre /paywall (ya no hay Alert "coming soon").
 *  - AccountScreen solo muestra el upsell si !isPro — tras compra/restore,
 *    refreshUser flipea isPro y la card desaparece sin reiniciar la app.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PlusUpsellCard } from '../PlusUpsellCard';
import AccountScreen from '../../../app/(tabs)/account';
import { useAuth } from '../../../lib/auth';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../../lib/api', () => ({ api: jest.fn() }));
// Secciones vecinas de Account fuera de foco en este test.
jest.mock('../ProfileCard', () => ({ ProfileCard: () => null }));
jest.mock('../TravelPreferencesSection', () => ({ TravelPreferencesSection: () => null }));
jest.mock('../SettingsSection', () => ({ SettingsSection: () => null }));
jest.mock('../DevToolsSection', () => ({ DevToolsSection: () => null }));
jest.mock('../LanguagePickerModal', () => ({ LanguagePickerModal: () => null }));
jest.mock('../../ui/ConfirmModal', () => ({ ConfirmModal: () => null }));

const mockUseAuth = useAuth as jest.Mock;

const baseAuth = {
  user: { id: 'u1', email: 'a@b.com', name: 'A', tier: 'free' as const },
  isAuthenticated: true,
  isAdmin: false,
  logout: jest.fn(),
  refreshUser: jest.fn(),
  setTierOverride: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('el CTA del upsell navega a /paywall', () => {
  render(<PlusUpsellCard />);

  fireEvent.press(screen.getByText('account.plusCta'));

  expect(router.push).toHaveBeenCalledWith('/paywall');
});

it('AccountScreen muestra el upsell para usuarios free', () => {
  mockUseAuth.mockReturnValue({ ...baseAuth, isPro: false });
  render(<AccountScreen />);

  expect(screen.getByText('account.plusCta')).toBeOnTheScreen();
});

it('AccountScreen oculta el upsell cuando isPro flipea (post-compra, sin reinicio)', () => {
  mockUseAuth.mockReturnValue({ ...baseAuth, isPro: true, user: { ...baseAuth.user, tier: 'pro' as const } });
  render(<AccountScreen />);

  expect(screen.queryByText('account.plusCta')).toBeNull();
});
