/**
 * DevTools de la pantalla Account: los botones flipan el tier REAL vía los
 * endpoints dev del backend (no un override solo-cliente) y refrescan `/account`,
 * más el reset de cuota. Cubre:
 *  - rename "Pro" -> "Plus" (la UI muestra "Plus"/"PLUS", nunca "Pro"/"PRO").
 *  - toggle async: éxito -> setDevTier(target) + refreshUser; 404 -> aviso, sin refreshUser.
 *  - reset quota: éxito -> resetDevQuota + refreshAiPlansQuota; 404 -> aviso, sin refresh.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DevToolsSection } from '../DevToolsSection';
import { useAuth } from '../../../lib/auth';
import { setDevTier, resetDevQuota } from '../../../lib/api';

// Real English strings so the rename assertions are meaningful (not key echoes).
jest.mock('react-i18next', () => {
  const en = jest.requireActual('../../../lib/i18n/en').default;
  const translate = (key: string) =>
    key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), en) ?? key;
  return { useTranslation: () => ({ t: translate, i18n: { language: 'en' } }) };
});

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain: Record<string, () => unknown> = {};
  chain.duration = () => chain;
  chain.delay = () => chain;
  return { __esModule: true, default: { View }, FadeInDown: chain };
});

jest.mock('../../../lib/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../../../lib/api', () => ({ setDevTier: jest.fn(), resetDevQuota: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockSetDevTier = setDevTier as jest.Mock;
const mockResetDevQuota = resetDevQuota as jest.Mock;

function auth(overrides: Record<string, unknown> = {}) {
  return {
    isPro: false,
    user: { id: 'u1', email: 'a@locallist.ai', name: 'A', tier: 'free' as const },
    refreshUser: jest.fn().mockResolvedValue('free'),
    refreshAiPlansQuota: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('DevToolsSection — rename Pro -> Plus', () => {
  it('usuario free: muestra "Switch to Plus" y nunca "Switch to Pro"', () => {
    mockUseAuth.mockReturnValue(auth({ isPro: false }));
    render(<DevToolsSection />);

    expect(screen.getByText('Switch to Plus')).toBeOnTheScreen();
    expect(screen.queryByText('Switch to Pro')).toBeNull();
    expect(screen.getByText('FREE')).toBeOnTheScreen();
  });

  it('usuario pro: badge "PLUS" (no "PRO") y label "Switch to Free"', () => {
    mockUseAuth.mockReturnValue(auth({ isPro: true, user: { id: 'u1', email: 'a@locallist.ai', name: 'A', tier: 'pro' as const } }));
    render(<DevToolsSection />);

    expect(screen.getByText('PLUS')).toBeOnTheScreen();
    expect(screen.queryByText('PRO')).toBeNull();
    expect(screen.getByText('Switch to Free')).toBeOnTheScreen();
  });
});

describe('DevToolsSection — toggle tier (async, endpoints dev reales)', () => {
  it('éxito: llama setDevTier con el tier objetivo y refresca /account', async () => {
    const a = auth({ isPro: false });
    mockUseAuth.mockReturnValue(a);
    mockSetDevTier.mockResolvedValue({ ok: true, disabled: false });

    render(<DevToolsSection />);
    fireEvent.press(screen.getByText('Switch to Plus'));

    await waitFor(() => expect(mockSetDevTier).toHaveBeenCalledWith('pro'));
    await waitFor(() => expect(a.refreshUser).toHaveBeenCalledTimes(1));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('pro -> free: llama setDevTier("free")', async () => {
    const a = auth({ isPro: true, user: { id: 'u1', email: 'a@locallist.ai', name: 'A', tier: 'pro' as const } });
    mockUseAuth.mockReturnValue(a);
    mockSetDevTier.mockResolvedValue({ ok: true, disabled: false });

    render(<DevToolsSection />);
    fireEvent.press(screen.getByText('Switch to Free'));

    await waitFor(() => expect(mockSetDevTier).toHaveBeenCalledWith('free'));
    await waitFor(() => expect(a.refreshUser).toHaveBeenCalledTimes(1));
  });

  it('404/disabled: avisa y NO cambia el tier local (no refreshUser)', async () => {
    const a = auth({ isPro: false });
    mockUseAuth.mockReturnValue(a);
    mockSetDevTier.mockResolvedValue({ ok: false, disabled: true });

    render(<DevToolsSection />);
    fireEvent.press(screen.getByText('Switch to Plus'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Not available',
      'Dev tier override is not enabled in this environment.',
    );
    expect(a.refreshUser).not.toHaveBeenCalled();
  });
});

describe('DevToolsSection — reset plan quota', () => {
  it('éxito: llama resetDevQuota y refresca la cuota', async () => {
    const a = auth();
    mockUseAuth.mockReturnValue(a);
    mockResetDevQuota.mockResolvedValue({ ok: true, disabled: false });

    render(<DevToolsSection />);
    fireEvent.press(screen.getByText('Reset plan quota'));

    await waitFor(() => expect(mockResetDevQuota).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(a.refreshAiPlansQuota).toHaveBeenCalledTimes(1));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('404/disabled: avisa y NO refresca la cuota', async () => {
    const a = auth();
    mockUseAuth.mockReturnValue(a);
    mockResetDevQuota.mockResolvedValue({ ok: false, disabled: true });

    render(<DevToolsSection />);
    fireEvent.press(screen.getByText('Reset plan quota'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    expect(a.refreshAiPlansQuota).not.toHaveBeenCalled();
  });
});
