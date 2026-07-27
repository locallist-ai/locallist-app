import { formatClock12h, formatTime12h, formatTimeRangeLine } from '../time';

describe('formatClock12h', () => {
  it('midnight 0:00 -> 12:00 AM (bug clasico 0->12)', () => {
    expect(formatClock12h(0, 0)).toBe('12:00 AM');
  });

  it('noon 12:00 -> 12:00 PM', () => {
    expect(formatClock12h(12, 0)).toBe('12:00 PM');
  });

  it('13:00 -> 1:00 PM (sin cero a la izquierda)', () => {
    expect(formatClock12h(13, 0)).toBe('1:00 PM');
  });

  it('23:59 -> 11:59 PM', () => {
    expect(formatClock12h(23, 59)).toBe('11:59 PM');
  });

  it('09:05 -> 9:05 AM (minuto con cero a la izquierda)', () => {
    expect(formatClock12h(9, 5)).toBe('9:05 AM');
  });

  it('11:00 -> 11:00 AM (justo antes de mediodia)', () => {
    expect(formatClock12h(11, 0)).toBe('11:00 AM');
  });
});

describe('formatTime12h (string "HH:mm")', () => {
  it('00:00 -> 12:00 AM', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
  });

  it('12:00 -> 12:00 PM', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  it('13:00 -> 1:00 PM', () => {
    expect(formatTime12h('13:00')).toBe('1:00 PM');
  });

  it('23:59 -> 11:59 PM', () => {
    expect(formatTime12h('23:59')).toBe('11:59 PM');
  });

  it('09:05 -> 9:05 AM', () => {
    expect(formatTime12h('09:05')).toBe('9:05 AM');
  });

  it('acepta "H:mm" sin cero a la izquierda en el input', () => {
    expect(formatTime12h('9:00')).toBe('9:00 AM');
  });

  it('devuelve el input intacto si no es una hora', () => {
    expect(formatTime12h('morning')).toBe('morning');
    expect(formatTime12h('99:99')).toBe('99:99');
  });
});

describe('formatTimeRangeLine', () => {
  it('convierte un rango 24h "09:00 - 17:00" a 12h', () => {
    expect(formatTimeRangeLine('09:00 - 17:00')).toBe('9:00 AM - 5:00 PM');
  });

  it('preserva la etiqueta de dia y convierte solo las horas', () => {
    expect(formatTimeRangeLine('Monday: 09:00 - 22:00')).toBe('Monday: 9:00 AM - 10:00 PM');
  });

  it('convierte medianoche y mediodia dentro del rango', () => {
    expect(formatTimeRangeLine('00:00 - 12:00')).toBe('12:00 AM - 12:00 PM');
  });

  it('no toca lineas que ya vienen en 12h (evita doble conversion)', () => {
    expect(formatTimeRangeLine('Monday: 9:00 AM - 5:00 PM')).toBe('Monday: 9:00 AM - 5:00 PM');
  });

  it('no toca texto sin horas', () => {
    expect(formatTimeRangeLine('Closed')).toBe('Closed');
  });
});
