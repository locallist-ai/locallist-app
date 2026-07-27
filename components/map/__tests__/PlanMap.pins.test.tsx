/**
 * Tests del render de PINES NUMERADOS de `PlanMap`.
 *
 * Cada parada del día se pinta como un marcador circular con su NÚMERO DE ORDEN
 * (1-based) dentro del día mostrado. `stops` llega ya day-scoped y ordenado por
 * `orderIndex` (lo hace `app/follow/[id].tsx`), así que el número = posición del
 * array + 1, espejo del "N / M" del `FollowDaySheet`. El pin activo (el stop
 * actual en Follow Mode) se distingue con relleno sunsetOrange; el resto quedan
 * en paperWhite con borde.
 *
 * MapLibre y los nativos se mockean (el PointAnnotation solo pinta sus hijos),
 * para poder montar el componente sin el motor de mapas.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PlanMap, type MapStop } from '../PlanMap';
import { colors } from '../../../lib/theme';

jest.mock('@maplibre/maplibre-react-native', () => {
  const RN = jest.requireActual('react-native');
  const ReactActual = jest.requireActual('react');
  const Passthrough = ReactActual.forwardRef(
    ({ children }: { children?: React.ReactNode }, _ref: unknown) =>
      ReactActual.createElement(RN.View, null, children),
  );
  return {
    __esModule: true,
    default: {
      MapView: Passthrough,
      Camera: ReactActual.forwardRef((_props: unknown, _ref: unknown) => null),
      PointAnnotation: Passthrough,
      ShapeSource: Passthrough,
      LineLayer: () => null,
    },
  };
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: number) => v,
    withSpring: (v: number) => v,
  };
});

jest.mock('../useFollowLocation', () => ({
  useFollowLocation: () => ({ status: 'idle', coordinate: null }),
}));

jest.mock('../useOfflinePack', () => ({
  useOfflinePack: () => ({ status: 'idle', percentage: 0, retry: jest.fn() }),
}));

jest.mock('../../../lib/map/tiles', () => ({
  mapStyleURL: () => 'https://example.test/style.json',
  mapAttribution: () => 'OSM',
  OSM_COPYRIGHT_URL: 'https://example.test/copyright',
}));

const makeStop = (n: number, orderIndex: number, number?: number): MapStop => ({
  id: `stop-${n}`,
  name: `Stop ${n}`,
  latitude: 25.7 + n * 0.01,
  longitude: -80.1 - n * 0.01,
  category: 'Coffee',
  orderIndex,
  number,
});

// Day-scoped, already sorted by orderIndex (como llega desde el follow screen).
// `number` = posición en el día completo (aquí contigua: sin huecos de coords).
const dayStops: MapStop[] = [makeStop(1, 0, 1), makeStop(2, 1, 2), makeStop(3, 2, 3)];

const bg = (testID: string): string | undefined => {
  const flat = StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    backgroundColor?: string;
  };
  return flat.backgroundColor;
};

const color = (testID: string): string | undefined => {
  const flat = StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    color?: string;
  };
  return flat.color;
};

describe('PlanMap numbered pins', () => {
  it('pinta un pin por parada del día con su número 1-based en orden', () => {
    render(<PlanMap stops={dayStops} activePinIndex={0} />);

    // Uno por stop, y el número = posición del array + 1 (no el índice crudo).
    expect(screen.getByTestId('plan-map-pin-label-0')).toHaveTextContent('1');
    expect(screen.getByTestId('plan-map-pin-label-1')).toHaveTextContent('2');
    expect(screen.getByTestId('plan-map-pin-label-2')).toHaveTextContent('3');

    // Sin pin "0" (mutación index -> index caería aquí y arriba).
    expect(screen.queryByText('0')).toBeNull();

    // Un pin por parada, ni más ni menos.
    expect(screen.queryByTestId('plan-map-pin-3')).toBeNull();
  });

  it('distingue el pin activo del resto (relleno + color de número)', () => {
    render(<PlanMap stops={dayStops} activePinIndex={1} />);

    // Activo: relleno sunsetOrange + número paperWhite.
    expect(bg('plan-map-pin-1')).toBe(colors.sunsetOrange);
    expect(color('plan-map-pin-label-1')).toBe(colors.paperWhite);

    // No-activos: relleno paperWhite + número deepOcean (secundario).
    expect(bg('plan-map-pin-0')).toBe(colors.paperWhite);
    expect(bg('plan-map-pin-2')).toBe(colors.paperWhite);
    expect(color('plan-map-pin-label-0')).toBe(colors.deepOcean);

    // El activo NO comparte el relleno de los inactivos (cae si se quita la
    // distinción del activo).
    expect(bg('plan-map-pin-1')).not.toBe(bg('plan-map-pin-0'));
  });

  it('el número del pin activo coincide con la posición activa del itinerario', () => {
    render(<PlanMap stops={dayStops} activePinIndex={2} />);

    // activePinIndex=2 -> el pin activo muestra "3" (posición 1-based).
    expect(screen.getByTestId('plan-map-pin-label-2')).toHaveTextContent('3');
    expect(bg('plan-map-pin-2')).toBe(colors.sunsetOrange);
  });

  it('usa stop.number (posición del día completo), no el índice del array', () => {
    // Simula un stop intermedio sin coords: el día completo era 1,2,3,4 pero el
    // "2" no tiene pin, así que los pines llevan number 1,3,4 (no 1,2,3).
    const gappy: MapStop[] = [makeStop(1, 0, 1), makeStop(3, 2, 3), makeStop(4, 3, 4)];
    render(<PlanMap stops={gappy} activePinIndex={0} />);

    // Mutación: si el pin usara `index + 1` mostraría 1,2,3 y esto caería.
    expect(screen.getByTestId('plan-map-pin-label-0')).toHaveTextContent('1');
    expect(screen.getByTestId('plan-map-pin-label-1')).toHaveTextContent('3');
    expect(screen.getByTestId('plan-map-pin-label-2')).toHaveTextContent('4');
    expect(screen.queryByText('2')).toBeNull();
  });

  it('con activePinIndex=-1 (stop actual sin coords) no destaca ningún pin', () => {
    render(<PlanMap stops={dayStops} activePinIndex={-1} />);

    // Ningún pin en sunsetOrange: destacar el "1" contradiría el N/M del sheet.
    expect(bg('plan-map-pin-0')).toBe(colors.paperWhite);
    expect(bg('plan-map-pin-1')).toBe(colors.paperWhite);
    expect(bg('plan-map-pin-2')).toBe(colors.paperWhite);
    // Los números se siguen pintando (solo cambia el destacado).
    expect(screen.getByTestId('plan-map-pin-label-0')).toHaveTextContent('1');
  });

  it('con numbered=false no pinta números (marcador de ubicación simple)', () => {
    // Detalle de sitio: un único stop, sin "1" que se lea como "paso 1".
    render(<PlanMap stops={[makeStop(1, 0)]} numbered={false} />);

    expect(screen.queryByTestId('plan-map-pin-label-0')).toBeNull();
    expect(screen.queryByText('1')).toBeNull();
    // El pin (marcador) sigue existiendo.
    expect(screen.getByTestId('plan-map-pin-0')).toBeTruthy();
  });
});
