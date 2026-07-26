/**
 * Tests de comportamiento de la pantalla de favoritos (`app/favorites.tsx`).
 *
 * Cubre:
 *  - Render de la lista de PlaceDto favoritos.
 *  - Empty state cuando no hay favoritos.
 *  - Quitar optimista: un place que ya no está en el Set de ids (por un toggle
 *    optimista) desaparece de la lista sin refetch.
 *  - Error de carga: estado de error con reintento.
 *  - MAJOR 1 (regresión): el offset de paginación sigue al BACKEND — quitar
 *    filas de la página cargada y paginar no deja huecos ni duplicados.
 *  - MAJOR 2 (regresión): vaciar la página cargada con más favoritos en el
 *    backend NO pinta un empty state falso; carga la siguiente página.
 */
import React from 'react';
import { FlatList } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
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

  /**
   * Simula el backend real: un array mutable ordenado; getFavorites hace slice
   * por offset/limit y devuelve el total actual. Quitar un favorito = sacarlo
   * del array (el DELETE optimista encoge el backend) Y del Set de ids local.
   */
  function setupBackend(count: number) {
    let backend = Array.from({ length: count }, (_, i) => makePlace(`p${i}`, `Place ${i}`));
    let idsSet = new Set(backend.map((p) => p.id));
    mockGetFavorites.mockImplementation((limit: number, offset: number) =>
      Promise.resolve({
        data: { places: backend.slice(offset, offset + limit), total: backend.length },
        error: null,
        status: 200,
      }),
    );
    mockUseFavorites.mockImplementation(() => ({ ids: idsSet, loaded: true, toggle: jest.fn() }));
    return {
      remove(ids: string[]) {
        backend = backend.filter((p) => !ids.includes(p.id));
        idsSet = new Set([...idsSet].filter((id) => !ids.includes(id)));
      },
    };
  }

  const flatListIds = () =>
    (screen.UNSAFE_getByType(FlatList).props.data as Place[]).map((p) => p.id);

  it('MAJOR 1 (regresión): 25 favoritos, quitar 3 de la página 1 y paginar → los 22 restantes, sin huecos ni duplicados', async () => {
    const backend = setupBackend(25);

    render(<FavoritesScreen />);
    await waitFor(() => expect(screen.getByText('Place 0')).toBeTruthy());
    expect(flatListIds()).toHaveLength(20);

    // Quitar p0-p2 (optimista: fuera del Set y del backend).
    backend.remove(['p0', 'p1', 'p2']);
    screen.rerender(<FavoritesScreen />);
    await waitFor(() => expect(flatListIds()).toHaveLength(17));

    // Paginar.
    await act(async () => {
      await screen.UNSAFE_getByType(FlatList).props.onEndReached();
    });

    // El offset sigue al backend encogido (17 visibles), no al array crudo (20).
    expect(mockGetFavorites).toHaveBeenLastCalledWith(20, 17);

    // Los 22 restantes (p3..p24) TODOS presentes, sin huecos ni duplicados.
    const ids = flatListIds();
    const expected = Array.from({ length: 22 }, (_, i) => `p${i + 3}`);
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('MAJOR 2 (regresión): 40 favoritos, quitar los 20 visibles → carga más, NUNCA empty state', async () => {
    const backend = setupBackend(40);

    render(<FavoritesScreen />);
    await waitFor(() => expect(screen.getByText('Place 0')).toBeTruthy());

    // Quitar toda la página cargada (p0-p19).
    backend.remove(Array.from({ length: 20 }, (_, i) => `p${i}`));
    screen.rerender(<FavoritesScreen />);

    // El guard auto-carga la siguiente página en vez de pintar empty.
    await waitFor(() => expect(screen.getByText('Place 20')).toBeTruthy());
    expect(screen.queryByText('favorites.emptyTitle')).toBeNull();

    // La página cargada es exactamente el resto del backend (p20..p39).
    const expected = Array.from({ length: 20 }, (_, i) => `p${i + 20}`);
    expect(flatListIds()).toEqual(expected);
  });
});
