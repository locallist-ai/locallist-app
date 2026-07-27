// Formateo de hora a 12h AM/PM, UNIFORME en EN y ES (decisión de Pablo).
//
// Fuente ÚNICA de verdad: toda la app pinta horas (llegada a paradas, ETA,
// horarios de apertura, bloques de tiempo) a traves de estas funciones en vez
// de mostrar las 24h crudas ("15:00"). Salida: "3:00 PM", sin cero a la
// izquierda en la hora. AM/PM es universal, va literal (no i18n).

/**
 * Formatea una hora de reloj (hora 0-23, minuto 0-59) como 12h AM/PM, sin cero
 * a la izquierda en la hora. Casos frontera clasicos:
 *   0  -> "12:00 AM" (medianoche)
 *   12 -> "12:00 PM" (mediodia)
 *   13 -> "1:00 PM"
 *   23 -> "11:xx PM"
 * Normaliza valores fuera de rango por modulo (defensivo).
 */
export function formatClock12h(hour: number, minute: number): string {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  const m = ((Math.trunc(minute) % 60) + 60) % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Formatea un string de hora 24h ("HH:mm" o "H:mm", p.ej. "09:00" o "9:00")
 * como 12h AM/PM. Devuelve el input sin tocar si no es parseable como hora
 * (nunca lanza), para no corromper texto que no sea una hora.
 */
export function formatTime12h(value: string): string {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;
  return formatClock12h(hour, minute);
}

/**
 * Reformatea una linea de texto que puede contener horas 24h "HH:mm" (rangos de
 * apertura tipo "09:00 - 17:00") a 12h AM/PM, preservando etiquetas de dia y
 * separadores. No-op si la linea ya trae marcadores AM/PM (evita doble
 * conversion cuando el origen ya viene en 12h).
 */
export function formatTimeRangeLine(line: string): string {
  if (/\b[ap]\.?\s?m\.?\b/i.test(line)) return line;
  return line.replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mm) => {
    const hour = Number(h);
    const minute = Number(mm);
    if (hour > 23 || minute > 59) return m;
    return formatClock12h(hour, minute);
  });
}
