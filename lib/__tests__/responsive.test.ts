import { computeResponsive } from '../responsive';

// Tests sobre la lógica pura — no requieren mocks de React Native.

describe('computeResponsive', () => {
  describe('iPhone SE 3rd gen (375×667)', () => {
    const r = computeResponsive(375, 667);

    it('compact = true', () => {
      expect(r.compact).toBe(true);
    });

    it('short = true', () => {
      expect(r.short).toBe(true);
    });

    it('pick devuelve compactValue', () => {
      expect(r.pick(140, 80)).toBe(80);
    });

    it('ms(16) < 16 (escala por debajo del baseline)', () => {
      expect(r.ms(16)).toBeLessThan(16);
    });

    it('scale(390) ≈ 375 (proporcional al ancho)', () => {
      expect(r.scale(390)).toBeCloseTo(375, 1);
    });
  });

  describe('iPhone 14 (390×844) — baseline', () => {
    const r = computeResponsive(390, 844);

    it('compact = false', () => {
      expect(r.compact).toBe(false);
    });

    it('short = false', () => {
      expect(r.short).toBe(false);
    });

    it('ms(16) = 16 exacto en baseline', () => {
      expect(r.ms(16)).toBeCloseTo(16, 5);
    });

    it('pick devuelve defaultValue', () => {
      expect(r.pick(140, 80)).toBe(140);
    });
  });

  describe('iPhone 16 Pro Max (430×932)', () => {
    const r = computeResponsive(430, 932);

    it('compact = false', () => {
      expect(r.compact).toBe(false);
    });

    it('short = false', () => {
      expect(r.short).toBe(false);
    });

    it('ms(16) > 16 (upscale mínimo en pantalla grande)', () => {
      expect(r.ms(16)).toBeGreaterThan(16);
    });

    it('upscale atenuado: ms(16) < scale(16)', () => {
      expect(r.ms(16)).toBeLessThan(r.scale(16));
    });
  });

  describe('breakpoints exactos', () => {
    it('width = 375 es compact (límite incluido)', () => {
      expect(computeResponsive(375, 900).compact).toBe(true);
    });

    it('width = 376 no es compact', () => {
      expect(computeResponsive(376, 900).compact).toBe(false);
    });

    it('height = 700 es short (límite incluido)', () => {
      expect(computeResponsive(390, 700).short).toBe(true);
    });

    it('height = 701 no es short', () => {
      expect(computeResponsive(390, 701).short).toBe(false);
    });
  });

  describe('ms factor personalizado', () => {
    const r = computeResponsive(375, 667);

    it('factor 0 devuelve el tamaño original sin escalar', () => {
      expect(r.ms(20, 0)).toBeCloseTo(20, 5);
    });

    it('factor 1 = escala lineal completa', () => {
      expect(r.ms(20, 1)).toBeCloseTo(r.scale(20), 5);
    });
  });
});
