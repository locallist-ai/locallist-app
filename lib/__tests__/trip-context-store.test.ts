/**
 * Tests del contrato de `lib/trip-context-store`:
 *
 *  - Al importar, hidrata la ciudad y la fecha de inicio persistidas en SafeStore
 *    (init eager): el hook arranca en loading mientras la lectura está en vuelo y
 *    resuelve a los valores guardados.
 *  - `setSelectedCity` persiste bajo la clave estable, actualiza el getter
 *    síncrono y notifica a los hooks montados.
 *  - `clearSelectedCity` borra de SafeStore y deja la ciudad a null.
 *  - `startDate`: por defecto = HOY cuando no hay nada guardado (la fecha SIEMPRE
 *    está presente); `setStartDate` persiste bajo su clave y notifica.
 *
 * El módulo mantiene estado a nivel de módulo y dispara la carga UNA vez al
 * importarse, así que los tests son secuenciales sobre la misma instancia
 * (resetear módulos duplicaría React y rompería renderHook). La lectura inicial
 * de la ciudad se controla con una promesa diferida expuesta por el mock; la
 * fecha inicial resuelve a null (→ default hoy).
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { todayIso, addDaysIso } from '../dates';

const CITY_KEY = 'locallist_selected_city';
const START_DATE_KEY = 'locallist_trip_start_date';

jest.mock('../safe-store', () => {
  const mem: Record<string, string> = {};
  let resolveCityRead: (v: string | null) => void = () => {};
  const cityRead = new Promise<string | null>((res) => { resolveCityRead = res; });
  return {
    // Resuelve la lectura inicial diferida de la CIUDAD (la fecha resuelve a null ya).
    __resolveCityRead: (v: string | null) => resolveCityRead(v),
    getItemAsync: jest.fn((key: string) => {
      if (key === CITY_KEY) return cityRead;
      return Promise.resolve(mem[key] ?? null);
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => { mem[key] = value; }),
    deleteItemAsync: jest.fn(async (key: string) => { delete mem[key]; }),
  };
});

import * as store from '../trip-context-store';

const safeStore = jest.requireMock('../safe-store') as {
  __resolveCityRead: (v: string | null) => void;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

describe('trip-context-store (secuencial: misma instancia de módulo)', () => {
  it('arranca en loading y resuelve a la ciudad persistida; startDate default = hoy', async () => {
    const { result } = renderHook(() => store.useTripContext());

    // Lectura de ciudad aún en vuelo → loading y sin ciudad
    expect(result.current.city).toBeNull();
    expect(result.current.loading).toBe(true);
    // La fecha efectiva SIEMPRE está presente: default hoy incluso antes de hidratar
    expect(result.current.startDate).toBe(todayIso());
    expect(store.getSelectedCitySync()).toBeNull();
    expect(safeStore.getItemAsync).toHaveBeenCalledWith(CITY_KEY);
    expect(safeStore.getItemAsync).toHaveBeenCalledWith(START_DATE_KEY);

    await act(async () => { safeStore.__resolveCityRead('Madrid'); });

    expect(result.current.city).toBe('Madrid');
    expect(result.current.loading).toBe(false);
    // Sin fecha guardada → sigue siendo hoy
    expect(result.current.startDate).toBe(todayIso());
    expect(store.getStartDateSync()).toBe(todayIso());
  });

  it('setSelectedCity persiste bajo la clave estable y notifica al hook montado', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await store.setSelectedCity('Lisboa'); });

    expect(result.current.city).toBe('Lisboa');
    expect(store.getSelectedCitySync()).toBe('Lisboa');
    expect(safeStore.setItemAsync).toHaveBeenCalledWith(CITY_KEY, 'Lisboa');
  });

  it('setStartDate persiste bajo su clave, actualiza el getter y notifica al hook', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await store.setStartDate('2026-09-01'); });

    expect(result.current.startDate).toBe('2026-09-01');
    expect(store.getStartDateSync()).toBe('2026-09-01');
    expect(safeStore.setItemAsync).toHaveBeenCalledWith(START_DATE_KEY, '2026-09-01');
  });

  it('clearStartDate borra la fecha y vuelve al default hoy', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.startDate).toBe('2026-09-01'));

    await act(async () => { await store.clearStartDate(); });

    expect(result.current.startDate).toBe(todayIso());
    expect(store.getStartDateSync()).toBe(todayIso());
    expect(safeStore.deleteItemAsync).toHaveBeenCalledWith(START_DATE_KEY);
  });

  it('clearSelectedCity borra de SafeStore y deja la ciudad a null en hook y getter', async () => {
    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.city).toBe('Lisboa'));

    await act(async () => { await store.clearSelectedCity(); });

    expect(result.current.city).toBeNull();
    expect(store.getSelectedCitySync()).toBeNull();
    expect(safeStore.deleteItemAsync).toHaveBeenCalledWith(CITY_KEY);
  });

  it('M4: fecha rancia persistida (en el pasado) se normaliza a HOY al leer; una futura válida se conserva', async () => {
    // Repro del bug: el usuario eligió una fecha que, días después, ya es pasada.
    // El getter efectivo la clampa a hoy → nunca se lee (ni se enviaría) fuera de
    // la ventana [hoy, hoy+365] del backend (→ no 400 invalid_start_date).
    await act(async () => { await store.setStartDate('2020-01-01'); });
    expect(store.getStartDateSync()).toBe(todayIso());

    const { result } = renderHook(() => store.useTripContext());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.startDate).toBe(todayIso());

    // Una fecha futura dentro de la ventana se conserva intacta (no se toca).
    const future = addDaysIso(todayIso(), 30)!;
    await act(async () => { await store.setStartDate(future); });
    expect(store.getStartDateSync()).toBe(future);
    await waitFor(() => expect(result.current.startDate).toBe(future));
  });

  it('un hook montado tras la hidratación no pasa por loading', async () => {
    await act(async () => { await store.setSelectedCity('Oporto'); });

    const { result } = renderHook(() => store.useTripContext());

    // El estado ya está inicializado: ni parpadeo de loading ni ciudad vacía
    expect(result.current.city).toBe('Oporto');
    expect(result.current.loading).toBe(false);
  });
});
