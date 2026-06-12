/**
 * Tests del contrato de `lib/trip-context-store`:
 *
 *  - Al importar, hidrata la ciudad persistida en SafeStore (init eager):
 *    el hook arranca en loading mientras la lectura está en vuelo y resuelve
 *    a la ciudad guardada.
 *  - `setSelectedCity` persiste bajo la clave estable, actualiza el getter
 *    síncrono y notifica a los hooks montados.
 *  - `clearSelectedCity` borra de SafeStore y deja la ciudad a null.
 *
 * El módulo mantiene estado a nivel de módulo y dispara la carga UNA vez al
 * importarse, así que los tests son secuenciales sobre la misma instancia
 * (resetear módulos duplicaría React y rompería renderHook). La lectura
 * inicial se controla con una promesa diferida expuesta por el mock.
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../safe-store', () => {
  let resolveRead: (v: string | null) => void = () => {};
  const initialRead = new Promise<string | null>((res) => { resolveRead = res; });
  return {
    // Resuelve la lectura inicial diferida (la única que hace el store)
    __resolveInitialRead: (v: string | null) => resolveRead(v),
    getItemAsync: jest.fn(() => initialRead),
    setItemAsync: jest.fn(async () => {}),
    deleteItemAsync: jest.fn(async () => {}),
  };
});

import * as store from '../trip-context-store';

const safeStore = jest.requireMock('../safe-store') as {
  __resolveInitialRead: (v: string | null) => void;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const CITY_KEY = 'locallist_selected_city';

describe('trip-context-store (secuencial: misma instancia de módulo)', () => {
  it('arranca en loading mientras la lectura inicial está en vuelo y resuelve a la ciudad persistida', async () => {
    const { result } = renderHook(() => store.useTripContext());

    // Lectura aún en vuelo → loading y sin ciudad
    expect(result.current).toEqual({ city: null, loading: true });
    expect(store.getSelectedCitySync()).toBeNull();
    expect(safeStore.getItemAsync).toHaveBeenCalledWith(CITY_KEY);

    await act(async () => { safeStore.__resolveInitialRead('Madrid'); });

    expect(result.current).toEqual({ city: 'Madrid', loading: false });
    expect(store.getSelectedCitySync()).toBe('Madrid');
  });

  it('setSelectedCity persiste bajo la clave estable y notifica al hook montado', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await store.setSelectedCity('Lisboa'); });

    expect(result.current).toEqual({ city: 'Lisboa', loading: false });
    expect(store.getSelectedCitySync()).toBe('Lisboa');
    expect(safeStore.setItemAsync).toHaveBeenCalledWith(CITY_KEY, 'Lisboa');
  });

  it('clearSelectedCity borra de SafeStore y deja la ciudad a null en hook y getter', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.city).toBe('Lisboa'));

    await act(async () => { await store.clearSelectedCity(); });

    expect(result.current).toEqual({ city: null, loading: false });
    expect(store.getSelectedCitySync()).toBeNull();
    expect(safeStore.deleteItemAsync).toHaveBeenCalledWith(CITY_KEY);
  });

  it('un hook montado tras la hidratación no pasa por loading', async () => {
    await act(async () => { await store.setSelectedCity('Oporto'); });

    const { result } = renderHook(() => store.useTripContext());

    // El estado ya está inicializado: ni parpadeo de loading ni ciudad vacía
    expect(result.current).toEqual({ city: 'Oporto', loading: false });
  });
});
