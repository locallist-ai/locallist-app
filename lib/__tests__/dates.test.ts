/**
 * Tests de `lib/dates` — helpers de fecha local (sin drift de timezone) que
 * sostienen la captura de la fecha de inicio y el display de "día N = start + N-1".
 *
 * Foco (review adversarial): la derivación del día es correcta incl. cruce de
 * mes/año, los planes legacy sin fecha devuelven null (no crashean, no muestran
 * fecha), y el parseo rechaza fechas imposibles.
 */

import {
  toIsoDate,
  todayIso,
  parseIsoDate,
  addDaysIso,
  isoForDay,
  formatDayDate,
  formatFullDate,
  clampIso,
} from '../dates';

describe('toIsoDate / todayIso (local, sin drift)', () => {
  it('serializa una fecha local a yyyy-MM-dd con padding', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05'); // 5 ene 2026
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('todayIso usa el día LOCAL, no UTC (no salta de día por zona horaria)', () => {
    // 15 jun 2026 a las 23:30 hora local → sigue siendo 2026-06-15 aunque en UTC
    // ya sea día 16 en offsets negativos.
    const localLateNight = new Date(2026, 5, 15, 23, 30, 0);
    expect(todayIso(localLateNight)).toBe('2026-06-15');
  });
});

describe('parseIsoDate', () => {
  it('parsea una fecha válida a medianoche local', () => {
    const d = parseIsoDate('2026-06-15')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it('devuelve null para null/undefined/formato inválido', () => {
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('2026-6-1')).toBeNull();
    expect(parseIsoDate('15/06/2026')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('rechaza fechas imposibles (overflow de calendario)', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-00-10')).toBeNull();
  });
});

describe('addDaysIso', () => {
  it('suma días cruzando fin de mes', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('resta días', () => {
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('null si la base es inválida', () => {
    expect(addDaysIso('bad', 3)).toBeNull();
  });
});

describe('isoForDay (día N = start + N-1)', () => {
  it('día 1 es la fecha de inicio', () => {
    expect(isoForDay('2026-06-15', 1)).toBe('2026-06-15');
  });
  it('día 2 es start + 1', () => {
    expect(isoForDay('2026-06-15', 2)).toBe('2026-06-16');
  });
  it('cruza el fin de mes correctamente', () => {
    // start 30 jun, día 3 = 2 jul
    expect(isoForDay('2026-06-30', 3)).toBe('2026-07-02');
  });
  it('cruza fin de año', () => {
    expect(isoForDay('2026-12-30', 4)).toBe('2027-01-02');
  });
  it('null para plan legacy sin fecha o día inválido', () => {
    expect(isoForDay(null, 1)).toBeNull();
    expect(isoForDay(undefined, 2)).toBeNull();
    expect(isoForDay('2026-06-15', 0)).toBeNull();
    expect(isoForDay('2026-06-15', -1)).toBeNull();
  });
});

describe('formatDayDate (localizado, tolerante)', () => {
  it('formatea día 2 en inglés (weekday + mes + día)', () => {
    // start lunes 15 jun 2026 → día 2 = martes 16 jun
    const label = formatDayDate('2026-06-15', 2, 'en')!;
    expect(label).toMatch(/Tue/);
    expect(label).toMatch(/Jun/);
    expect(label).toMatch(/16/);
  });

  it('formatea día 2 en español', () => {
    const label = formatDayDate('2026-06-15', 2, 'es')!;
    expect(label.toLowerCase()).toMatch(/mar/); // martes
    expect(label.toLowerCase()).toMatch(/jun/);
    expect(label).toMatch(/16/);
  });

  it('cruza el mes en el display (día 3 desde 30 jun → 2 jul)', () => {
    const label = formatDayDate('2026-06-30', 3, 'en')!;
    expect(label).toMatch(/Jul/);
    expect(label).toMatch(/2/);
  });

  it('devuelve null para plan legacy sin fecha (no muestra fecha, no crashea)', () => {
    expect(formatDayDate(null, 1, 'en')).toBeNull();
    expect(formatDayDate(undefined, 1, 'es')).toBeNull();
    expect(formatDayDate('garbage', 1, 'en')).toBeNull();
  });
});

describe('formatFullDate', () => {
  it('incluye el año', () => {
    expect(formatFullDate('2026-06-15', 'en')).toMatch(/2026/);
  });
  it('null si inválida', () => {
    expect(formatFullDate(null, 'en')).toBeNull();
  });
});

describe('clampIso', () => {
  it('recorta por debajo del mínimo y por encima del máximo', () => {
    expect(clampIso('2026-06-01', '2026-06-10', '2027-06-10')).toBe('2026-06-10');
    expect(clampIso('2028-01-01', '2026-06-10', '2027-06-10')).toBe('2027-06-10');
  });
  it('deja pasar una fecha dentro del rango', () => {
    expect(clampIso('2026-08-01', '2026-06-10', '2027-06-10')).toBe('2026-08-01');
  });
});
