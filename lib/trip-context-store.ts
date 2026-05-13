import { useState, useEffect } from 'react';
import * as SafeStore from './safe-store';

const CITY_KEY = 'locallist_selected_city';

let _city: string | null = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;
const _subs = new Set<() => void>();

function _ensureInitialized(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const stored = await SafeStore.getItemAsync(CITY_KEY);
    _city = stored;
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

export function getSelectedCitySync(): string | null {
  return _city;
}

function subscribeToCity(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

export function useTripContext(): { city: string | null; loading: boolean } {
  const [city, setCity] = useState<string | null>(_city);
  const [loading, setLoading] = useState(!_initialized);

  useEffect(() => {
    let mounted = true;

    _ensureInitialized().then(() => {
      if (mounted) {
        setCity(_city);
        setLoading(false);
      }
    }).catch(() => {
      if (mounted) setLoading(false);
    });

    const unsub = subscribeToCity(() => {
      if (mounted) {
        setCity(_city);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { city, loading };
}
