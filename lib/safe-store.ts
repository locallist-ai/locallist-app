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

const fallback = new Map<string, string>();

let secureStoreAvailable: boolean | null = null;

const probeSecureStore = async (): Promise<boolean> => {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    // Probe minimal: write+read+delete. Si tira, marcamos unavailable.
    const probeKey = '__safe_store_probe__';
    await SecureStore.setItemAsync(probeKey, '1');
    await SecureStore.getItemAsync(probeKey);
    await SecureStore.deleteItemAsync(probeKey);
    secureStoreAvailable = true;
  } catch {
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
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
