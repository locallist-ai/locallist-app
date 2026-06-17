/**
 * Tests del reducer puro de `use-plan-editor` (sin renderizar React).
 *
 * Cubre las 8 acciones: INIT, REORDER, DELETE_STOP, MOVE_TO_DAY, ADD_STOP,
 * REPLACE_STOP, SET_SAVING y MARK_SAVED — incluyendo transiciones
 * inválidas/no-op (MOVE_TO_DAY con índice fuera de rango, acción desconocida)
 * y los invariantes transversales: recálculo de orderIndex, flag isDirty e
 * inmutabilidad del estado de entrada.
 */

// `use-plan-editor` importa `lib/api`, que lanza en carga si falta
// EXPO_PUBLIC_API_URL; el reducer no lo necesita, así que lo cortamos aquí.
jest.mock('../../api', () => ({ api: jest.fn() }));

import { reducer, type EditorState, type EditorAction, type DayGroup } from '../use-plan-editor';
import type { Place, PlanStop } from '../../types';

const makePlace = (id: string, over: Partial<Place> = {}): Place => ({
  id,
  name: `Place ${id}`,
  category: 'Food',
  subcategories: [],
  neighborhood: null,
  city: 'Madrid',
  whyThisPlace: '',
  bestFor: null,
  suitableFor: null,
  bestTime: null,
  priceRange: null,
  photos: null,
  latitude: 40.4168,
  longitude: -3.7038,
  googleRating: null,
  googleReviewCount: null,
  source: 'google',
  openingHours: null,
  ...over,
});

const makeStop = (placeId: string, dayNumber: number, orderIndex: number): PlanStop & { id?: string } => ({
  placeId,
  dayNumber,
  orderIndex,
  timeBlock: null,
  suggestedArrival: null,
  suggestedDurationMin: 60,
  travelFromPrevious: null,
  place: makePlace(placeId),
});

/** Estado base: día 1 con stops a-b-c, día 2 con stop d. */
const baseState = (): EditorState => ({
  days: [
    { dayNumber: 1, stops: [makeStop('a', 1, 0), makeStop('b', 1, 1), makeStop('c', 1, 2)] },
    { dayNumber: 2, stops: [makeStop('d', 2, 0)] },
  ],
  isDirty: false,
  isSaving: false,
});

const stopIds = (state: EditorState, dayNumber: number) =>
  state.days.find((d) => d.dayNumber === dayNumber)?.stops.map((s) => s.placeId);

const orderIndices = (state: EditorState, dayNumber: number) =>
  state.days.find((d) => d.dayNumber === dayNumber)?.stops.map((s) => s.orderIndex);

describe('plan editor reducer', () => {
  it('INIT reemplaza los días y resetea isDirty e isSaving', () => {
    const dirty: EditorState = { ...baseState(), isDirty: true, isSaving: true };
    const days: DayGroup[] = [{ dayNumber: 1, stops: [makeStop('x', 1, 0)] }];

    const next = reducer(dirty, { type: 'INIT', days });

    expect(next).toEqual({ days, isDirty: false, isSaving: false });
  });

  it('REORDER mueve el stop dentro del día, recalcula orderIndex y marca dirty', () => {
    const state = baseState();
    const next = reducer(state, { type: 'REORDER', dayNumber: 1, from: 0, to: 2 });

    expect(stopIds(next, 1)).toEqual(['b', 'c', 'a']);
    expect(orderIndices(next, 1)).toEqual([0, 1, 2]);
    // El otro día no se toca y el original no se muta
    expect(stopIds(next, 2)).toEqual(['d']);
    expect(next.isDirty).toBe(true);
    expect(stopIds(state, 1)).toEqual(['a', 'b', 'c']);
  });

  it('DELETE_STOP elimina por índice, compacta orderIndex y marca dirty', () => {
    const state = baseState();
    const next = reducer(state, { type: 'DELETE_STOP', dayNumber: 1, stopIndex: 1 });

    expect(stopIds(next, 1)).toEqual(['a', 'c']);
    expect(orderIndices(next, 1)).toEqual([0, 1]);
    expect(next.isDirty).toBe(true);
    expect(stopIds(state, 1)).toEqual(['a', 'b', 'c']);
  });

  it('MOVE_TO_DAY a un día existente añade al final con dayNumber y orderIndex recalculados', () => {
    const state = baseState();
    const next = reducer(state, { type: 'MOVE_TO_DAY', fromDay: 1, stopIndex: 0, toDay: 2 });

    expect(stopIds(next, 1)).toEqual(['b', 'c']);
    expect(stopIds(next, 2)).toEqual(['d', 'a']);
    const moved = next.days.find((d) => d.dayNumber === 2)!.stops[1];
    expect(moved.dayNumber).toBe(2);
    expect(moved.orderIndex).toBe(1);
    expect(next.isDirty).toBe(true);
  });

  it('MOVE_TO_DAY a un día nuevo lo crea ordenado por dayNumber', () => {
    const state = baseState();
    const next = reducer(state, { type: 'MOVE_TO_DAY', fromDay: 2, stopIndex: 0, toDay: 3 });

    // El día 2 queda vacío y el reducer lo elimina; el día 3 se crea al final
    expect(next.days.map((d) => d.dayNumber)).toEqual([1, 3]);
    expect(stopIds(next, 3)).toEqual(['d']);
    expect(next.days.find((d) => d.dayNumber === 3)!.stops[0].dayNumber).toBe(3);
  });

  it('MOVE_TO_DAY con stopIndex fuera de rango o día origen inexistente es no-op (misma referencia)', () => {
    const state = baseState();

    expect(reducer(state, { type: 'MOVE_TO_DAY', fromDay: 1, stopIndex: 99, toDay: 2 })).toBe(state);
    expect(reducer(state, { type: 'MOVE_TO_DAY', fromDay: 99, stopIndex: 0, toDay: 2 })).toBe(state);
  });

  it('ADD_STOP añade al final del día existente con los defaults del stop nuevo', () => {
    const state = baseState();
    const place = makePlace('z');
    const next = reducer(state, { type: 'ADD_STOP', dayNumber: 2, place });

    expect(stopIds(next, 2)).toEqual(['d', 'z']);
    const added = next.days.find((d) => d.dayNumber === 2)!.stops[1];
    expect(added).toMatchObject({
      placeId: 'z',
      dayNumber: 2,
      orderIndex: 1,
      timeBlock: null,
      suggestedArrival: null,
      suggestedDurationMin: 45,
      travelFromPrevious: null,
      place,
    });
    expect(next.isDirty).toBe(true);
  });

  it('ADD_STOP a un día inexistente lo crea manteniendo el orden de días', () => {
    const state = baseState();
    const next = reducer(state, { type: 'ADD_STOP', dayNumber: 3, place: makePlace('z') });

    expect(next.days.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
    expect(stopIds(next, 3)).toEqual(['z']);
    expect(orderIndices(next, 3)).toEqual([0]);
  });

  it('REPLACE_STOP sustituye placeId y place conservando horario y duración del slot', () => {
    const state = baseState();
    const place = makePlace('z');
    const next = reducer(state, { type: 'REPLACE_STOP', dayNumber: 1, stopIndex: 1, place });

    expect(stopIds(next, 1)).toEqual(['a', 'z', 'c']);
    const replaced = next.days.find((d) => d.dayNumber === 1)!.stops[1];
    expect(replaced.place).toBe(place);
    // Conserva los campos del slot original (no es un stop nuevo)
    expect(replaced.suggestedDurationMin).toBe(60);
    expect(replaced.orderIndex).toBe(1);
    expect(next.isDirty).toBe(true);
    // Los stops no afectados mantienen la referencia original
    expect(next.days.find((d) => d.dayNumber === 1)!.stops[0]).toBe(state.days[0].stops[0]);
  });

  it('SET_SAVING solo toca isSaving y MARK_SAVED limpia isDirty + isSaving', () => {
    const state = baseState();

    const saving = reducer({ ...state, isDirty: true }, { type: 'SET_SAVING', value: true });
    expect(saving.isSaving).toBe(true);
    expect(saving.isDirty).toBe(true);
    expect(saving.days).toBe(state.days);

    const saved = reducer(saving, { type: 'MARK_SAVED' });
    expect(saved.isDirty).toBe(false);
    expect(saved.isSaving).toBe(false);
    expect(saved.days).toBe(state.days);
  });

  it('una acción desconocida devuelve el estado intacto (misma referencia)', () => {
    const state = baseState();
    const next = reducer(state, { type: 'UNKNOWN' } as unknown as EditorAction);

    expect(next).toBe(state);
  });
});
