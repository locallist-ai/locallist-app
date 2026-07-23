// Date utilities for start-date capture + per-day date display.
//
// All dates are handled as LOCAL calendar dates with NO timezone shifting: a
// `yyyy-MM-dd` string parses to LOCAL midnight (via `new Date(y, m-1, d)`), not
// `new Date('2026-06-15')` which is UTC midnight and drifts a full day in
// negative offsets when formatted locally. "Day N of the trip" must never jump
// a calendar day because of the device timezone.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local `yyyy-MM-dd` for a Date (uses the device's local calendar day). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local date as `yyyy-MM-dd`. `now` is injectable for tests. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Parse a `yyyy-MM-dd` string to a LOCAL midnight Date, or null when the string
 * is missing, malformed, or an impossible calendar date (e.g. 2026-02-31).
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Reject overflow: JS rolls 2026-02-31 into March, which is not the date asked for.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Add `days` (may be negative) to an iso date; null if the base is invalid. */
export function addDaysIso(iso: string, days: number): string | null {
  const base = parseIsoDate(iso);
  if (!base) return null;
  return toIsoDate(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days));
}

/**
 * ISO date for day N of a plan: day 1 = startDate, day 2 = start + 1, ...
 * Correctly crosses month/year boundaries. Returns null for legacy plans
 * (no/invalid startDate) or an out-of-range day number.
 */
export function isoForDay(startIso: string | null | undefined, dayNumber: number): string | null {
  const start = parseIsoDate(startIso);
  if (!start || !Number.isFinite(dayNumber) || dayNumber < 1) return null;
  return toIsoDate(
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + (dayNumber - 1)),
  );
}

/**
 * Localized short label for day N: "Mon, Jun 16" (en) / "lun, 16 jun" (es).
 * Returns null when there is no usable startDate (legacy plans) so callers can
 * simply omit the date without special-casing.
 */
export function formatDayDate(
  startIso: string | null | undefined,
  dayNumber: number,
  locale = 'en',
): string | null {
  const iso = isoForDay(startIso, dayNumber);
  if (!iso) return null;
  const d = parseIsoDate(iso)!;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    // Intl missing/locale unsupported: fall back to the ISO string (never crash).
    return iso;
  }
}

/**
 * Localized full label for a single date (used by the picker trigger):
 * "Mon, Jun 16, 2026" (en) / "lun, 16 jun 2026" (es). Null if invalid.
 */
export function formatFullDate(iso: string | null | undefined, locale = 'en'): string | null {
  const d = parseIsoDate(iso);
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso ?? null;
  }
}

/** Clamp an iso date into [minIso, maxIso] inclusive. Lexicographic compare is
 * valid for zero-padded `yyyy-MM-dd`. Assumes all three are well-formed. */
export function clampIso(iso: string, minIso: string, maxIso: string): string {
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

/**
 * Normalize a start date into the valid trip window `[today, today+365]`,
 * mirroring the backend `IsStartDateWithinWindow`. A stale persisted date in the
 * past (e.g. chosen days ago) normalizes to TODAY so it never reaches the backend
 * out-of-window (→ no `400 invalid_start_date`); a date past the +365 horizon
 * clamps to `today+365`; a valid in-window date is preserved. Missing/malformed
 * input falls back to today. `now` is injectable for tests. This is the single
 * place that couples the app's window to the backend's: call it at READ and
 * before every SEND so a rancid date can never block generation.
 */
export function clampToTripWindow(iso: string | null | undefined, now: Date = new Date()): string {
  const today = todayIso(now);
  const max = addDaysIso(today, 365) ?? today;
  if (!iso || !parseIsoDate(iso)) return today;
  return clampIso(iso, today, max);
}
