/**
 * ImportIdle — self-first idle screen. The happy path (CTA) is one tap with the
 * attribution UI FOLDED; expanding reveals the platform selector, and a
 * third-party pick reveals the disclaimer + handle. Assertions fail against a
 * mutation that un-collapses the attribution or drops the third-party gating.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ImportIdle } from '../ImportIdle';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseProps = {
  platform: 'self' as const,
  onPlatformChange: jest.fn(),
  creatorHandle: '',
  onHandleChange: jest.fn(),
  errorKey: null,
  retryable: false,
  onChoose: jest.fn(),
  onRetry: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

it('por defecto: CTA visible, atribución PLEGADA (sin pills ni disclaimer)', () => {
  render(<ImportIdle {...baseProps} />);

  expect(screen.getByTestId('import-choose')).toBeTruthy();
  expect(screen.getByTestId('import-attribution-toggle')).toBeTruthy();
  // Folded: the third-party controls are not mounted.
  expect(screen.queryByTestId('import-platform-tiktok')).toBeNull();
  expect(screen.queryByTestId('import-disclaimer')).toBeNull();
  expect(screen.queryByTestId('import-creator-handle')).toBeNull();
});

it('CTA dispara onChoose (camino feliz 1-tap)', () => {
  const onChoose = jest.fn();
  render(<ImportIdle {...baseProps} onChoose={onChoose} />);
  fireEvent.press(screen.getByTestId('import-choose'));
  expect(onChoose).toHaveBeenCalledTimes(1);
});

it('expandir atribución revela el selector de plataforma; self no muestra disclaimer', () => {
  render(<ImportIdle {...baseProps} />);
  fireEvent.press(screen.getByTestId('import-attribution-toggle'));

  expect(screen.getByTestId('import-platform-tiktok')).toBeTruthy();
  // platform === 'self' → no disclaimer / no handle even when expanded.
  expect(screen.queryByTestId('import-disclaimer')).toBeNull();
  expect(screen.queryByTestId('import-creator-handle')).toBeNull();

  fireEvent.press(screen.getByTestId('import-platform-tiktok'));
  expect(baseProps.onPlatformChange).toHaveBeenCalledWith('tiktok');
});

it('plataforma de terceros: disclaimer + campo handle visibles al expandir', () => {
  render(<ImportIdle {...baseProps} platform="tiktok" />);
  fireEvent.press(screen.getByTestId('import-attribution-toggle'));

  expect(screen.getByTestId('import-disclaimer')).toBeTruthy();
  expect(screen.getByText('import.disclaimer')).toBeTruthy();

  fireEvent.changeText(screen.getByTestId('import-creator-handle'), '@guide');
  expect(baseProps.onHandleChange).toHaveBeenCalledWith('@guide');
});

it('errorKey pinta el banner; retryable muestra el botón de reintento', () => {
  const onRetry = jest.fn();
  render(<ImportIdle {...baseProps} errorKey="import.errorGeneric" retryable onRetry={onRetry} />);

  expect(screen.getByText('import.errorGeneric')).toBeTruthy();
  fireEvent.press(screen.getByTestId('import-retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
