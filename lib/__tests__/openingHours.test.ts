import { getOpenState } from '../openingHours';
import type { OpeningHours } from '../types';

function makeHours(openH: number, closeH: number): OpeningHours {
  return {
    periods: [{ open: { day: 1, hour: openH, minute: 0 }, close: { day: 1, hour: closeH, minute: 0 } }],
    weekdayDescriptions: [],
  };
}

function at(hour: number, minute = 0): Date {
  const d = new Date(2024, 0, 15, hour, minute, 0); // arbitrary Monday
  return d;
}

describe('getOpenState', () => {
  it('returns unknown for null hours', () => {
    expect(getOpenState(null)).toEqual({ state: 'unknown', hint: null });
  });

  it('returns unknown for empty periods', () => {
    expect(getOpenState({ periods: [], weekdayDescriptions: [] })).toEqual({ state: 'unknown', hint: null });
  });

  it('returns open when inside period', () => {
    const { state } = getOpenState(makeHours(9, 22), at(12));
    expect(state).toBe('open');
  });

  it('returns closed before opening', () => {
    const { state } = getOpenState(makeHours(9, 22), at(8));
    expect(state).toBe('closed');
  });

  it('returns closed after close time', () => {
    const { state } = getOpenState(makeHours(9, 17), at(18));
    expect(state).toBe('closed');
  });

  it('hint shows close time when open', () => {
    const { hint } = getOpenState(makeHours(9, 22), at(12));
    expect(hint).toBe('Closes at 22:00');
  });

  it('hint shows next open when closed and next window exists', () => {
    const { hint } = getOpenState(makeHours(14, 22), at(9));
    expect(hint).toBe('Opens at 14:00');
  });

  it('hint is null when closed with no next window', () => {
    const { hint } = getOpenState(makeHours(9, 17), at(22));
    expect(hint).toBeNull();
  });

  it('treats null close as always open (24h)', () => {
    const hours: OpeningHours = {
      periods: [{ open: { day: 0, hour: 0, minute: 0 }, close: null }],
      weekdayDescriptions: [],
    };
    expect(getOpenState(hours, at(3)).state).toBe('open');
    expect(getOpenState(hours, at(14)).state).toBe('open');
  });

  it('handles midnight-crossing period — before midnight', () => {
    const hours: OpeningHours = {
      periods: [{ open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
      weekdayDescriptions: [],
    };
    expect(getOpenState(hours, at(23)).state).toBe('open');
  });

  it('handles midnight-crossing period — after midnight', () => {
    const hours: OpeningHours = {
      periods: [{ open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
      weekdayDescriptions: [],
    };
    expect(getOpenState(hours, at(1)).state).toBe('open');
  });
});
