/**
 * Tests de comportamiento de la pantalla de favoritos (`app/favorites.tsx`).
 *
 * Cubre:
 *  - Render de la lista de PlaceDto favoritos.
 *  - Empty state cuando no hay favoritos.
 *  - Quitar optimista: un place que ya no está en el Set de ids (por un toggle
 *    optimista) desaparece de la lista sin refetch.
 *  - Error de carga: estado de error con reintento.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import FavoritesScreen from '../favorites';
import { getFavorites } from '../../lib/api';
import type { Place } from '../../lib/types';

const mockUseFavorites = jest.fn();

jest.mock('../../lib/api', () => ({ getFavorites: jest.fn() }));
jest.mock('../../lib/favorites-store', () => ({ useFavorites: () => mockUseFavorites() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
// PhotoHero pinta el título; se sustituye por un stub ligero sin expo-image.
jest.mock('../../components/ui/PhotoHero', () => {
  const { Text } = jest.requireActual('react-native');
  return { PhotoHero: ({ title }: { title?: string }) => <Text>{title}</Text> };
});
jest.mock('../../components/ui/FavoriteButton', () => ({ FavoriteButton: () => null }));

const mockGetFavorites = getFavorites as jest.Mock;

const makePlace = (id: string, name: string): Place => ({
  id,
  name,
  category: 'Food',
  subcategories: [],
  neighborhood: 'Downtown',
  city: 'Miami',
  whyThisPlace: '',
  bestFor: null,
  suitableFor: null,
  bestTime: null,
  priceRange: '$$',
  photos: ['https://cdn.example.com/x.jpg'],
  photoSource: 'google',
  latitude: null,
  longitude: null,
  googleRating: null,
  googleReviewCount: null,
  source: 'curated',
  openingHours: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFavorites.mockReturnValue({ ids: new Set(['a', 'b']), loaded: true, toggle: jest.fn() });
});

describe('FavoritesScreen', () => {
  it('renderiza la lista de favoritos', async () => {
    mockGetFavorites.mockResolvedValue({
      data: { places: [makePlace('a', 'Café A'), makePlace('b', 'Bar B')], total: 2 },
      error: null,
      status: 200,
    });

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText('Café A')).toBeTruthy());
    expect(screen.getByText('Bar B')).toBeTruthy();
  });

  it('muestra el empty state cuando no hay favoritos', async () => {
    mockGetFavorites.mockResolvedValue({ data: { places: [], total: 0 }, error: null, status: 200 });

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText('favorites.emptyTitle')).toBeTruthy());
    expect(screen.getByText('favorites.exploreCta')).toBeTruthy();
  });

  it('quitar optimista: un place fuera del Set de ids no se pinta', async () => {
    // La API devolvió a y b, pero el Set solo tiene 'a' (b se quitó optimista).
    mockUseFavorites.mockReturnValue({ ids: new Set(['a']), loaded: true, toggle: jest.fn() });
    mockGetFavorites.mockResolvedValue({
      data: { places: [makePlace('a', 'Café A'), makePlace('b', 'Bar B')], total: 2 },
      error: null,
      status: 200,
    });

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText('Café A')).toBeTruthy());
    expect(screen.queryByText('Bar B')).toBeNull();
  });

  it('error de carga: muestra el estado de error con reintento', async () => {
    mockGetFavorites.mockResolvedValue({ data: null, error: 'boom', status: 500 });

    render(<FavoritesScreen />);

    await waitFor(() => expect(screen.getByText('boom')).toBeTruthy());
    expect(screen.getByText('common.tryAgain')).toBeTruthy();
  });
});
