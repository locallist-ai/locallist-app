import { useState, useEffect } from 'react';
import * as SafeStore from './safe-store';
import { clampToTripWindow } from './dates';

const CITY_KEY = 'locallist_selected_city';
const START_DATE_KEY = 'locallist_trip_start_date';

let _city: string | null = null;
// Persisted start date (`yyyy-MM-dd`) or null when the user has not chosen one.
// The EFFECTIVE start date (what the app captures/sends/displays) is always a
// concrete date: `getStartDateSync()` falls back to TODAY so a date is ALWAYS
// present ("selector 100%" — la fecha siempre se manda, default hoy, editable).
let _startDate: string | null = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;
const _subs = new Set<() => void>();

/**
 * Effective start date: the stored one, or today when unset. Never null, and
 * ALWAYS normalized into the valid `[today, today+365]` window: a date chosen on
 * a previous day that is now in the past resolves to TODAY here, so a rancid
 * persisted value is never read (or later sent) out-of-window. The persisted raw
 * value is left untouched; only the effective read is clamped.
 */
export function getStartDateSync(): string {
  return clampToTripWindow(_startDate);
}

function _ensureInitialized(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const [storedCity, storedDate] = await Promise.all([
      SafeStore.getItemAsync(CITY_KEY),
      SafeStore.getItemAsync(START_DATE_KEY),
    ]);
    _city = storedCity;
    _startDate = storedDate;
    _initialized = true;
    _subs.forEach((cb) => cb());
  })();
  return _initPromise;
}

// Start loading eagerly so it's ready before components mount
_ensureInitialized().catch(() => {});

export async function setSelectedCity(cityName: string): Promise<void> {
  _city = cityName;
  _initialized = true;
  await SafeStore.setItemAsync(CITY_KEY, cityName);
  _subs.forEach((cb) => cb());
}

export async function clearSelectedCity(): Promise<void> {
  _city = null;
  await SafeStore.deleteItemAsync(CITY_KEY);
  _subs.forEach((cb) => cb());
}

/** Persist the user-chosen trip start date (`yyyy-MM-dd`). */
export async function setStartDate(iso: string): Promise<void> {
  _startDate = iso;
  _initialized = true;
  await SafeStore.setItemAsync(START_DATE_KEY, iso);
  _subs.forEach((cb) => cb());
}

/** Forget the chosen date; the effective date falls back to today again. */
export async function clearStartDate(): Promise<void> {
  _startDate = null;
  await SafeStore.deleteItemAsync(START_DATE_KEY);
  _subs.forEach((cb) => cb());
}

export function getSelectedCitySync(): string | null {
  return _city;
}

function subscribeToCity(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

export function useTripContext(): { city: string | null; startDate: string; loading: boolean } {
  const [city, setCity] = useState<string | null>(_city);
  const [startDate, setStartDateState] = useState<string>(getStartDateSync());
  const [loading, setLoading] = useState(!_initialized);

  useEffect(() => {
    let mounted = true;

    const sync = () => {
      if (!mounted) return;
      setCity(_city);
      setStartDateState(getStartDateSync());
      setLoading(false);
    };

    _ensureInitialized().then(sync).catch(() => {
      if (mounted) setLoading(false);
    });

    const unsub = subscribeToCity(sync);

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { city, startDate, loading };
}
