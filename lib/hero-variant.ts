import { useEffect, useState } from 'react';
import * as SecureStore from './safe-store';

// Pequeño store dev-only para alternar el background del wizard. Pablo
// 2026-04-25 quiere A/B entre photo (actual), Skia particles (Fase B), y
// Veo video loop (Fase C). El store usa expo-secure-store por consistencia
// con el resto de prefs (auth tokens) y un pub/sub in-memory para
// sincronizar suscriptores en multiples pantallas.

export type HeroVariant = 'photo' | 'skia' | 'veo';

const STORAGE_KEY = 'hero_variant_v1';
const listeners = new Set<(v: HeroVariant) => void>();
let current: HeroVariant = 'photo';
let hydrated = false;

const hydrate = async () => {
  if (hydrated) return;
  hydrated = true;
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY);
    if (v === 'photo' || v === 'skia' || v === 'veo') {
      current = v;
      listeners.forEach((l) => l(current));
    }
  } catch {
    // SecureStore puede fallar en simulator si faltan entitlements de
    // keychain (Pablo 2026-04-26). Caemos a default 'photo' silenciosamente
    // para no bloquear el startup. La feature es dev-only y solo persistencia.
  }
};

// Hidratamos en background al import — la primera lectura llega lista para
// la primera renderización siguiente.
hydrate();

export const useHeroVariant = (): [HeroVariant, (v: HeroVariant) => void] => {
  const [variant, setVariant] = useState<HeroVariant>(current);

  useEffect(() => {
    const listener = (v: HeroVariant) => setVariant(v);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = (next: HeroVariant) => {
    current = next;
    setVariant(next);
    // best-effort persistence — try/catch para entitlement errors en simulator.
    try {
      SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
    } catch {
      // ignore
    }
    listeners.forEach((l) => l(next));
  };

  return [variant, update];
};
