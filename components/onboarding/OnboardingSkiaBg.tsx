import React, { useEffect, useMemo } from 'react';
import { useWindowDimensions, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  BlurMask,
  DashPathEffect,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';

// OnboardingSkiaBg — variante CLARA del "Itinerary Dynamics" de HeroSkiaBg
// (pins + ruta punteada en drift + walker recorriendo la curva). Reusa la misma
// técnica Skia + reanimated worklets, pero recoloreada para vivir sobre el
// gradiente crema del onboarding: es DECORACIÓN de fondo, no debe competir con el
// contenido. Glows en 0.10-0.22, líneas/pins en 0.35-0.55. Paleta de marca:
// ruta + walker en electricBlue, pins en sunsetOrange.
//
// Se DUPLICA la geometría bezier de HeroSkiaBg a propósito: aísla por completo
// esta variante (cero riesgo de regresión sobre el fondo oscuro de home/plans,
// que sigue usando HeroSkiaBg tal cual) y permite tunear motion/opacidades para
// una sensación de fondo sutil sin tocar el original.

interface PinSpec {
  cx: number;
  cy: number;
  pulseDelay: number;
}

const PINS: PinSpec[] = [
  { cx: 0.16, cy: 0.20, pulseDelay: 0 },
  { cx: 0.74, cy: 0.30, pulseDelay: 800 },
  { cx: 0.28, cy: 0.56, pulseDelay: 1600 },
  { cx: 0.84, cy: 0.78, pulseDelay: 2400 },
];

const ROUTE_DASH = [10, 8] as const;
const ROUTE_PHASE_CYCLE_MS = 6000;
const PULSE_CYCLE_MS = 2400;
const WALK_CYCLE_MS = 15000; // 15s vuelta completa por la ruta

interface Pt {
  x: number;
  y: number;
}
interface Segment {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
}

const buildSegments = (w: number, h: number): Segment[] => {
  const pts = PINS.map((p) => ({ x: p.cx * w, y: p.cy * h }));
  const segs: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const cur = pts[i];
    const next = pts[i + 1];
    segs.push({
      p0: cur,
      p1: { x: cur.x + (next.x - cur.x) * 0.5, y: cur.y },
      p2: { x: cur.x + (next.x - cur.x) * 0.5, y: next.y },
      p3: next,
    });
  }
  return segs;
};

const buildRoutePath = (segments: Segment[]) => {
  const path = Skia.Path.Make();
  if (segments.length === 0) return path;
  path.moveTo(segments[0].p0.x, segments[0].p0.y);
  for (const s of segments) {
    path.cubicTo(s.p1.x, s.p1.y, s.p2.x, s.p2.y, s.p3.x, s.p3.y);
  }
  return path;
};

// Pin — halo sunsetOrange suave (pulsa sin negro, color explícito) + anillo y
// punto naranja tenues. Opacidades bajas: es decoración sobre crema.
const Pin: React.FC<{ x: number; y: number; pulseDelay: number }> = ({ x, y, pulseDelay }) => {
  const t = useSharedValue(0);

  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: PULSE_CYCLE_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }, pulseDelay);
    return () => clearTimeout(id);
  }, [pulseDelay]);

  const haloOpacity = useDerivedValue(() => 0.10 + t.value * 0.12);
  const haloRadius = useDerivedValue(() => 14 + t.value * 10);

  return (
    <Group>
      {/* Halo warm sunsetOrange, muy tenue */}
      <Circle cx={x} cy={y} r={haloRadius} color="rgba(249, 115, 22, 0.85)" opacity={haloOpacity}>
        <BlurMask blur={14} style="solid" />
      </Circle>
      {/* Anillo sunsetOrange */}
      <Circle cx={x} cy={y} r={5.5} color="rgba(249, 115, 22, 0.50)" />
      {/* Punto central sunsetOrange */}
      <Circle cx={x} cy={y} r={2.6} color="rgba(249, 115, 22, 0.9)" />
    </Group>
  );
};

const Route: React.FC<{ path: ReturnType<typeof buildRoutePath> }> = ({ path }) => {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = withRepeat(
      withTiming(ROUTE_DASH[0] + ROUTE_DASH[1], {
        duration: ROUTE_PHASE_CYCLE_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []);

  return (
    <Group>
      {/* Glow trasero — electricBlue difuso, muy tenue */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={6}
        color="rgba(59, 130, 246, 0.12)"
        strokeCap="round"
      >
        <BlurMask blur={6} style="normal" />
      </Path>
      {/* Línea principal punteada con dash drift — electricBlue */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={1.8}
        color="rgba(59, 130, 246, 0.40)"
        strokeCap="round"
      >
        <DashPathEffect intervals={[...ROUTE_DASH]} phase={phase} />
      </Path>
    </Group>
  );
};

// Walker — punto progresivo recorriendo la ruta (viajero caminando el itinerario).
// Bezier cubic interpolation en worklet via useDerivedValue.
const Walker: React.FC<{ segments: Segment[] }> = ({ segments }) => {
  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: WALK_CYCLE_MS, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const cx = useDerivedValue(() => {
    'worklet';
    const n = segments.length;
    if (n === 0) return 0;
    const scaled = progress.value * n;
    const segIdx = Math.min(Math.floor(scaled), n - 1);
    const t = scaled - segIdx;
    const s = segments[segIdx];
    const it = 1 - t;
    return (
      it * it * it * s.p0.x +
      3 * it * it * t * s.p1.x +
      3 * it * t * t * s.p2.x +
      t * t * t * s.p3.x
    );
  });
  const cy = useDerivedValue(() => {
    'worklet';
    const n = segments.length;
    if (n === 0) return 0;
    const scaled = progress.value * n;
    const segIdx = Math.min(Math.floor(scaled), n - 1);
    const t = scaled - segIdx;
    const s = segments[segIdx];
    const it = 1 - t;
    return (
      it * it * it * s.p0.y +
      3 * it * it * t * s.p1.y +
      3 * it * t * t * s.p2.y +
      t * t * t * s.p3.y
    );
  });

  const haloR = useDerivedValue(() => 16 + pulse.value * 8);
  const haloOpacity = useDerivedValue(() => 0.15 + pulse.value * 0.10);

  return (
    <Group>
      {/* Halo electricBlue alrededor del walker, tenue */}
      <Circle cx={cx} cy={cy} r={haloR} color="rgba(59, 130, 246, 0.85)" opacity={haloOpacity}>
        <BlurMask blur={12} style="solid" />
      </Circle>
      {/* Anillo electricBlue */}
      <Circle cx={cx} cy={cy} r={7} color="rgba(59, 130, 246, 0.55)" />
      {/* Punto interior electricBlue (el "viajero" abstracto) */}
      <Circle cx={cx} cy={cy} r={4} color="rgba(59, 130, 246, 0.9)" />
    </Group>
  );
};

/**
 * Fondo animado claro del onboarding. Se monta sobre el gradiente crema de
 * OnboardingBackground con `pointerEvents="none"`, ocupando todo el lienzo.
 */
export const OnboardingSkiaBg: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const segments = useMemo(() => buildSegments(width, height), [width, height]);
  const routePath = useMemo(() => buildRoutePath(segments), [segments]);

  return (
    <Canvas style={[StyleSheet.absoluteFill]} pointerEvents="none">
      <Route path={routePath} />
      {PINS.map((p, i) => (
        <Pin key={i} x={p.cx * width} y={p.cy * height} pulseDelay={p.pulseDelay} />
      ))}
      <Walker segments={segments} />
    </Canvas>
  );
};
