import { useWindowDimensions } from 'react-native';

// Diseño de referencia: iPhone 13/14 (390×844pt).
const BASE_WIDTH = 390;

export interface Responsive {
  width: number;
  height: number;
  /** true cuando width ≤ 375 (iPhone SE, 8, mini). */
  compact: boolean;
  /** true cuando height ≤ 700 (iPhone SE — sin safe area bottom). */
  short: boolean;
  /** Escala lineal por ancho. Para paddings, margins y alturas de layout. */
  scale: (size: number) => number;
  /** Escala atenuada (factor 0.5 por defecto). Para tipografía e iconos. */
  ms: (size: number, factor?: number) => number;
  /** Devuelve `compactValue` en pantallas compactas, `defaultValue` en el resto. */
  pick: <T>(defaultValue: T, compactValue: T) => T;
}

/** Lógica pura — testeable sin mocks de hooks. */
export function computeResponsive(width: number, height: number): Responsive {
  const compact = width <= 375;
  const short = height <= 700;
  const scale = (size: number) => (width / BASE_WIDTH) * size;
  const ms = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;
  return {
    width,
    height,
    compact,
    short,
    scale,
    ms,
    pick: (defaultValue, compactValue) => (compact ? compactValue : defaultValue),
  };
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  return computeResponsive(width, height);
}
