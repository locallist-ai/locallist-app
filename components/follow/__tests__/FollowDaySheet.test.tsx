/**
 * Tests de `FollowDaySheet` tras el rediseño UX (founder feedback):
 *
 *  - Selector de día = STEPPER centrado (‹ Día X de N ›): flechas mueven ±1 día
 *    vía `onChangeDay`, deshabilitadas en los extremos, ocultas con 1 solo día.
 *  - Stops = card grande PAGINADA: flechas ‹ › mueven ±1 stop dentro del día vía
 *    `onSelect(linearIndex)`, indicador de posición "X / Y", deshabilitadas en el
 *    primer/último stop del día.
 *  - El contenido del stop (nombre, etc.) se pinta desde `stop.place` como antes.
 *  - La acción existente "completar viaje" sigue invocando `onComplete`.
 *  - Paridad i18n: los labels nuevos renderizan en EN y ES.
 *
 * La navegación mueve `currentIndex` en el padre (que re-centra el mapa y, al
 * cambiar de día, resetea al primer stop); aquí se verifica el CONTRATO que el
 * sheet emite hacia el padre.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';
import { FollowDaySheet } from '../FollowDaySheet';
import type { PlanStop, Place } from '../../../lib/types';

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: View };
});
jest.mock('expo-image', () => {
  const { Image: RNImage } = jest.requireActual('react-native');
  return { Image: RNImage };
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Ionicons: () => null,
}));
jest.mock('../../ui/PhotoAttribution', () => ({ PhotoAttribution: () => null }));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: number) => v,
    runOnJS: (fn: (...a: unknown[]) => unknown) => fn,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const chainable = () => {
    const g: Record<string, () => unknown> = {};
    ['onStart', 'onChange', 'onEnd', 'onUpdate', 'activeOffsetX', 'failOffsetY', 'enabled'].forEach(
      (m) => {
        g[m] = () => g;
      },
    );
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: chainable,
      Tap: chainable,
      Race: () => chainable(),
    },
  };
});

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

const makePlace = (name: string): Place => ({
  id: `place-${name}`,
  name,
  category: 'Coffee',
  subcategories: [],
  neighborhood: 'Downtown',
  city: 'Miami',
  whyThisPlace: `Why ${name}`,
  bestFor: null,
  suitableFor: null,
  bestTime: null,
  priceRange: '$$',
  photos: [],
  photoSource: null,
  latitude: 25.7,
  longitude: -80.1,
  googleRating: 4.5,
  googleReviewCount: 100,
  source: 'curated',
  openingHours: null,
});

const stop = (name: string, dayNumber: number, orderIndex: number): PlanStop => ({
  placeId: `place-${name}`,
  dayNumber,
  orderIndex,
  timeBlock: 'morning',
  suggestedArrival: '09:00',
  suggestedDurationMin: 60,
  travelFromPrevious: null,
  place: makePlace(name),
});

// Day 1: A,B,C | Day 2: D,E | Day 3: F  (already flattened + sorted, like the parent)
const MULTI: PlanStop[] = [
  stop('A', 1, 0),
  stop('B', 1, 1),
  stop('C', 1, 2),
  stop('D', 2, 0),
  stop('E', 2, 1),
  stop('F', 3, 0),
];

const renderSheet = (currentIndex: number, over: Partial<React.ComponentProps<typeof FollowDaySheet>> = {}) => {
  const onSelect = jest.fn();
  const onChangeDay = jest.fn();
  const onComplete = jest.fn();
  render(
    <FollowDaySheet
      allStops={MULTI}
      currentIndex={currentIndex}
      onSelect={onSelect}
      onChangeDay={onChangeDay}
      onComplete={onComplete}
      {...over}
    />,
  );
  return { onSelect, onChangeDay, onComplete };
};

beforeEach(() => {
  jest.clearAllMocks();
  i18next.changeLanguage('en');
});

describe('FollowDaySheet — day stepper', () => {
  it('muestra "Day X of N" con el día del stop actual', () => {
    renderSheet(3); // stop D → day 2
    expect(screen.getByText('Day 2 of 3')).toBeTruthy();
  });

  it('flecha de día previa deshabilitada en el primer día, siguiente habilitada', () => {
    const { onChangeDay } = renderSheet(0); // day 1
    expect(screen.getByTestId('follow-day-prev').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('follow-day-next').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('follow-day-prev'));
    expect(onChangeDay).not.toHaveBeenCalled();
  });

  it('flecha siguiente avanza al siguiente día vía onChangeDay', () => {
    const { onChangeDay } = renderSheet(0); // day 1
    fireEvent.press(screen.getByTestId('follow-day-next'));
    expect(onChangeDay).toHaveBeenCalledWith(2);
  });

  it('flecha siguiente deshabilitada en el último día', () => {
    const { onChangeDay } = renderSheet(5); // day 3 (último)
    expect(screen.getByTestId('follow-day-next').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('follow-day-next'));
    expect(onChangeDay).not.toHaveBeenCalled();
  });

  it('flecha previa retrocede de día vía onChangeDay', () => {
    const { onChangeDay } = renderSheet(3); // day 2
    fireEvent.press(screen.getByTestId('follow-day-prev'));
    expect(onChangeDay).toHaveBeenCalledWith(1);
  });

  it('con un solo día NO renderiza flechas de día (label "Day 1 of 1")', () => {
    renderSheet(0, { allStops: [stop('Solo', 1, 0)] });
    expect(screen.getByText('Day 1 of 1')).toBeTruthy();
    expect(screen.queryByTestId('follow-day-prev')).toBeNull();
    expect(screen.queryByTestId('follow-day-next')).toBeNull();
  });
});

describe('FollowDaySheet — stops paginados', () => {
  it('muestra el indicador de posición "X / Y" del stop dentro del día', () => {
    renderSheet(1); // stop B → posición 2 de 3 en day 1
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('en el primer stop del día la flecha previa está deshabilitada y no navega', () => {
    const { onSelect } = renderSheet(0); // stop A, primero
    expect(screen.getByTestId('follow-stop-prev').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('follow-stop-prev'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('la flecha siguiente selecciona el siguiente stop del día (linearIndex)', () => {
    const { onSelect } = renderSheet(0); // stop A (linearIndex 0) → siguiente B (linearIndex 1)
    fireEvent.press(screen.getByTestId('follow-stop-next'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('la flecha previa selecciona el stop anterior del día (linearIndex)', () => {
    const { onSelect } = renderSheet(1); // stop B → previo A (linearIndex 0)
    fireEvent.press(screen.getByTestId('follow-stop-prev'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('en el último stop del día la flecha siguiente está deshabilitada y no navega', () => {
    const { onSelect } = renderSheet(2); // stop C, último del day 1
    expect(screen.getByTestId('follow-stop-next').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('follow-stop-next'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('la paginación es POR DÍA: indicador recalculado y siguiente stop del día correcto', () => {
    const { onSelect } = renderSheet(3); // stop D → day 2, posición 1 de 2
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('follow-stop-next')); // → E (linearIndex 4)
    expect(onSelect).toHaveBeenCalledWith(4);
  });
});

describe('FollowDaySheet — contenido del stop y acciones', () => {
  it('pinta el nombre del stop actual desde stop.place', () => {
    renderSheet(1); // stop B
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('Why B')).toBeTruthy();
  });

  it('el botón de completar sigue invocando onComplete', () => {
    const { onComplete } = renderSheet(0);
    fireEvent.press(screen.getByText('Complete trip'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('sin stops del día muestra el estado vacío', () => {
    // allStops vacío → currentStop undefined → sin place → empty state.
    renderSheet(0, { allStops: [] });
    expect(screen.getByText('No stops for today.')).toBeTruthy();
  });
});

describe('FollowDaySheet — paridad i18n (ES)', () => {
  it('renderiza el stepper de día y el indicador de stop en español', async () => {
    await i18next.changeLanguage('es');
    renderSheet(1); // day 1, stop B
    expect(screen.getByText('Día 1 de 3')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });
});
