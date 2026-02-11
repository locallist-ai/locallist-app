import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'll_device_id';

let cachedDeviceId: string | null = null;

async function readDeviceId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(DEVICE_ID_KEY)
      : null;
  }
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

async function writeDeviceId(id: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return;
  }
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
}

/** Get or create a persistent device ID for anonymous rate limiting */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const existing = await readDeviceId();
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }

  const newId: string = randomUUID();
  await writeDeviceId(newId);
  cachedDeviceId = newId;
  return newId;
}
