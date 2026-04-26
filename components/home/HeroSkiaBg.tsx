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

// HeroSkiaBg — Itinerary Dynamics (Pablo 2026-04-26).
// Pins + ruta dibujada + walker progresivo + compass.
//
// Pablo iter 2: el halo de los pins NO debe pulsar a negro (default color
// del Circle es black + BlurMask = blob oscuro). Color cream/orange explícito.
// Walker = pulsing dot recorriendo la curva bezier en bucle (sensación de
// alguien caminando la ruta).

interface PinSpec {
  cx: number;
  cy: number;
  pulseDelay: number;
}

const PINS: PinSpec[] = [
  { cx: 0.18, cy: 0.22, pulseDelay: 0 },
  { cx: 0.72, cy: 0.34, pulseDelay: 800 },
  { cx: 0.30, cy: 0.58, pulseDelay: 1600 },
  { cx: 0.82, cy: 0.74, pulseDelay: 2400 },
];

const ROUTE_DASH = [10, 8] as const;
const ROUTE_PHASE_CYCLE_MS = 6000;
const PULSE_CYCLE_MS = 2400;
const COMPASS_CYCLE_MS = 18000;
const WALK_CYCLE_MS = 14000; // 14s vuelta completa por la ruta

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

  const haloOpacity = useDerivedValue(() => 0.18 + t.value * 0.32);
  const haloRadius = useDerivedValue(() => 16 + t.value * 12);

  return (
    <Group>
      {/* Halo warm cream-orange (NO negro). Color explícito. */}
      <Circle cx={x} cy={y} r={haloRadius} color="rgba(249, 115, 22, 0.85)" opacity={haloOpacity}>
        <BlurMask blur={14} style="solid" />
      </Circle>
      {/* Outer ring cream */}
      <Circle cx={x} cy={y} r={6} color="rgba(255, 240, 220, 0.95)" />
      {/* Center dot sunsetOrange */}
      <Circle cx={x} cy={y} r={3} color="#f97316" />
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
      {/* Glow trasero — orange diffuso */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={6}
        color="rgba(249, 115, 22, 0.18)"
        strokeCap="round"
      >
        <BlurMask blur={6} style="normal" />
      </Path>
      {/* Línea principal con dash drift */}
      <Path
        path={path}
        style="stroke"
        strokeWidth={1.8}
        color="rgba(255, 240, 220, 0.65)"
        strokeCap="round"
      >
        <DashPathEffect intervals={[...ROUTE_DASH]} phase={phase} />
      </Path>
    </Group>
  );
};

// Walker — punto progresivo recorriendo la ruta (sensación de "viajero
// caminando"). Bezier cubic interpolation en worklet via useDerivedValue.
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

  // Position derivada de bezier en el segmento activo.
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

  const haloR = useDerivedValue(() => 18 + pulse.value * 8);
  const haloOpacity = useDerivedValue(() => 0.30 + pulse.value * 0.30);

  return (
    <Group>
      {/* Halo orange brillante alrededor del walker */}
      <Circle cx={cx} cy={cy} r={haloR} color="rgba(249, 115, 22, 0.90)" opacity={haloOpacity}>
        <BlurMask blur={12} style="solid" />
      </Circle>
      {/* Outer ring cream */}
      <Circle cx={cx} cy={cy} r={9} color="rgba(255, 240, 220, 0.95)" />
      {/* Inner solid orange (la "persona" abstracta) */}
      <Circle cx={cx} cy={cy} r={5} color="#f97316" />
    </Group>
  );
};

const Compass: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const angle = useSharedValue(0);
  useEffect(() => {
    angle.value = withRepeat(
      withTiming(2 * Math.PI, { duration: COMPASS_CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const cx = w - 56;
  const cy = h - 140;
  const radius = 28;

  const needlePath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(cx, cy - radius * 0.85);
    p.lineTo(cx + 4, cy);
    p.lineTo(cx, cy + radius * 0.85);
    p.lineTo(cx - 4, cy);
    p.close();
    return p;
  }, [cx, cy, radius]);

  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: angle.value },
    { translateX: -cx },
    { translateY: -cy },
  ]);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={radius} style="stroke" strokeWidth={1.2} color="rgba(255, 240, 220, 0.40)" />
      <Circle cx={cx} cy={cy} r={radius - 6} style="stroke" strokeWidth={0.8} color="rgba(255, 240, 220, 0.25)" />
      <Circle cx={cx} cy={cy - radius - 4} r={1.5} color="rgba(255, 240, 220, 0.7)" />
      <Group transform={transform}>
        <Path path={needlePath} color="#f97316" opacity={0.85} />
      </Group>
      <Circle cx={cx} cy={cy} r={2} color="rgba(255, 240, 220, 0.9)" />
    </Group>
  );
};

interface HeroSkiaBgProps {
  withCompass?: boolean;
}

export const HeroSkiaBg: React.FC<HeroSkiaBgProps> = ({ withCompass = true }) => {
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
      {withCompass && <Compass w={width} h={height} />}
    </Canvas>
  );
};
