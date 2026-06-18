/**
 * Tests del selector de ciudad (`app/(tabs)/home.tsx`) — gate de cobertura.
 *
 * El selector ofrece SOLO ciudades cubiertas (`GET /cities/live`). Cubre:
 *  - monta → llama getLiveCities y pinta las ciudades del backend.
 *  - red caída → fallback al catálogo bundled (Miami), sin pantalla rota.
 *  - seleccionar una ciudad guarda el trip context y navega al chat.
 *
 * CityCard, Skia y el design-system se mockean ligeros: solo nos interesa qué
 * ciudades se ofrecen y el handoff al chat, no su render visual.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import HomeTab from '../../../app/(tabs)/home';
import { getLiveCities } from '../../../lib/api';
import { setSelectedCity } from '../../../lib/trip-context-store';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/responsive', () => ({
  useResponsive: () => ({ width: 390, height: 844, compact: false }),
}));
jest.mock('../../../lib/api', () => ({ getLiveCities: jest.fn() }));
jest.mock('../../../lib/trip-context-store', () => ({
  setSelectedCity: jest.fn(() => Promise.resolve()),
}));
jest.mock('../HeroSkiaBg', () => ({ HeroSkiaBg: () => null }));
jest.mock('../../ui/design-system/EditorialTitle', () => ({ EditorialTitle: () => null }));
jest.mock('../../ui/design-system/StepSubtitle', () => ({ StepSubtitle: () => null }));
jest.mock('../CityCard', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    CityCard: ({ city, onSelect }: { city: { name: string }; onSelect: (n: string) => void }) => (
      <TouchableOpacity onPress={() => onSelect(city.name)}>
        <Text>{city.name}</Text>
      </TouchableOpacity>
    ),
  };
});

const mockGetLiveCities = getLiveCities as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const liveOk = (names: string[]) => ({
  data: { cities: names.map((name) => ({ id: null, name, country: null })) },
  error: null,
  errorBody: null,
  status: 200,
});

describe('home — selector de ciudad desde /cities/live', () => {
  it('pinta solo las ciudades LIVE devueltas por el backend', async () => {
    mockGetLiveCities.mockResolvedValueOnce(liveOk(['Miami', 'Lisboa']));
    render(<HomeTab />);

    await waitFor(() => expect(screen.getByText('Lisboa')).toBeTruthy());
    expect(screen.getByText('Miami')).toBeTruthy();
    expect(mockGetLiveCities).toHaveBeenCalledTimes(1);
  });

  it('con la red caída mantiene el catálogo bundled (Miami), sin romper', async () => {
    mockGetLiveCities.mockResolvedValueOnce({
      data: null,
      error: 'Network error',
      errorBody: null,
      status: 0,
    });
    render(<HomeTab />);

    // Render instantáneo desde el catálogo; el fallo no lo borra.
    expect(screen.getByText('Miami')).toBeTruthy();
    await waitFor(() => expect(mockGetLiveCities).toHaveBeenCalled());
    expect(screen.getByText('Miami')).toBeTruthy();
  });

  it('seleccionar una ciudad guarda el trip context y navega al chat', async () => {
    mockGetLiveCities.mockResolvedValueOnce(liveOk(['Miami']));
    render(<HomeTab />);
    await waitFor(() => expect(screen.getByText('Miami')).toBeTruthy());

    fireEvent.press(screen.getByText('Miami'));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/chat'));
    expect(setSelectedCity).toHaveBeenCalledWith('Miami');
  });
});
