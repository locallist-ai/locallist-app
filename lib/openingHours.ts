import { formatClock12h } from './helpers/time';
import type { OpeningHours, OpeningPeriod } from './types';

export type OpenState = 'open' | 'closed' | 'unknown';

export type OpeningStatus = {
  state: OpenState;
  /** Human-readable hint, e.g. "Opens at 2:00 PM" or "Closes at 10:00 PM" */
  hint: string | null;
};

/**
 * Returns whether a place is open at `now` given its opening hours data.
 * Phase-1 limitation: we have no real calendar date, so any period matching
 * the time-of-day (regardless of day-of-week) is treated as valid.
 */
export function getOpenState(hours: OpeningHours | null | undefined, now: Date = new Date()): OpeningStatus {
  if (!hours || hours.periods.length === 0) return { state: 'unknown', hint: null };

  const h = now.getHours() + now.getMinutes() / 60;

  for (const period of hours.periods) {
    if (fitsInPeriod(period, h)) {
      const closeHint = period.close
        ? `Closes at ${formatClock12h(period.close.hour, period.close.minute)}`
        : null;
      return { state: 'open', hint: closeHint };
    }
  }

  // Closed — find next opening
  const next = hours.periods
    .filter((p) => p.open !== null)
    .map((p) => p.open!.hour + p.open!.minute / 60)
    .filter((t) => t > h)
    .sort((a, b) => a - b)[0];

  const hint = next !== undefined
    ? `Opens at ${formatClock12h(Math.floor(next), Math.round((next % 1) * 60))}`
    : null;

  return { state: 'closed', hint };
}

function fitsInPeriod(period: OpeningPeriod, h: number): boolean {
  if (!period.open) return false;

  const openH  = period.open.hour  + period.open.minute  / 60;
  const closeH = period.close
    ? period.close.hour + period.close.minute / 60
    : null;

  if (closeH === null) return true; // 24h open

  if (closeH <= openH) {
    // Crosses midnight
    return h >= openH || h < closeH;
  }

  return h >= openH && h < closeH;
}
