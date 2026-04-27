import * as SecureStore from 'expo-secure-store';

// Wrapper resiliente sobre expo-secure-store. Pablo 2026-04-26:
// xcodebuild local sin Apple Developer cert no embebe entitlements de keychain
// correctamente (Sign-to-Run-Locally + ad-hoc no aplica entitlements custom).
// SpringBoard rechaza el launch si añadimos keychain-access-groups manualmente
// post-build. Sin la entitlement, SecureStore tira errSecMissingEntitlement
// "Falta una clave de autorización necesaria" que rompe auth, i18n, etc.
//
// Solución: try/catch alrededor de cada llamada + fallback a Map in-memory.
// En dev se pierden tokens al cerrar la app (re-login cada vez). En prod
// (TestFlight/App Store) EAS Build sí configura las entitlements y SecureStore
// funciona normal — el fallback nunca se activa.
//
// Hardening 2026-04-27 (audit follow-up D3): el probe ahora se memoiza como
// una Promise única + timeout 500ms. Antes, 3 modules (api.ts, i18n, hero-
// variant) hacían cold-start simultáneo y cada uno disparaba su propio probe
// (3 keychain writes para la misma key). En device con keychain locked podía
// stallar el splash. Con Promise compartida, se hace una sola roundtrip.

const fallback = new Map<string, string>();

const PROBE_KEY = '__safe_store_probe__';
const PROBE_TIMEOUT_MS = 500;

let probePromise: Promise<boolean> | null = null;

const probeSecureStore = (): Promise<boolean> => {
  if (probePromise) return probePromise;
  probePromise = (async () => {
    const probe = (async () => {
      try {
        await SecureStore.setItemAsync(PROBE_KEY, '1');
        await SecureStore.getItemAsync(PROBE_KEY);
        await SecureStore.deleteItemAsync(PROBE_KEY);
        return true;
      } catch {
        return false;
      }
    })();
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), PROBE_TIMEOUT_MS),
    );
    return Promise.race([probe, timeout]);
  })();
  return probePromise;
};

export async function getItemAsync(key: string): Promise<string | null> {
  if (await probeSecureStore()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return fallback.get(key) ?? null;
    }
  }
  return fallback.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  fallback.set(key, value);
  if (await probeSecureStore()) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // already in fallback
    }
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  fallback.delete(key);
  if (await probeSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
}

// Solo para tests — restablece la memoization de probe + el fallback.
// NO exportar en producción ni llamar fuera de tests.
export const __resetForTests = (): void => {
  probePromise = null;
  fallback.clear();
};
