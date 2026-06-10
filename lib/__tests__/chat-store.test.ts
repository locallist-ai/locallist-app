/**
 * Tests para `lib/chat-store.ts` — persistencia del sessionId del chat.
 *
 * El chat conversacional es el flujo primario de creación de planes (PR #50):
 * si el round-trip save/restore se rompe, el usuario pierde la sesión al
 * cerrar la app y el backend acumula sesiones huérfanas.
 *
 * Se mockea expo-secure-store (backend in-memory) y se ejercita chat-store
 * a través del safe-store real, igual que en producción.
 */

import { getSavedSessionId, saveSessionId, clearSessionId } from '../chat-store';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

describe('chat-store — persistencia de sesión', () => {
  beforeEach(async () => {
    await clearSessionId();
  });

  it('devuelve null cuando no hay sesión guardada', async () => {
    expect(await getSavedSessionId()).toBeNull();
  });

  it('round-trip: save → restore devuelve el mismo sessionId', async () => {
    await saveSessionId('sess-abc-123');
    expect(await getSavedSessionId()).toBe('sess-abc-123');
  });

  it('save sobrescribe la sesión anterior', async () => {
    await saveSessionId('sess-vieja');
    await saveSessionId('sess-nueva');
    expect(await getSavedSessionId()).toBe('sess-nueva');
  });

  it('clear elimina la sesión guardada', async () => {
    await saveSessionId('sess-abc-123');
    await clearSessionId();
    expect(await getSavedSessionId()).toBeNull();
  });

  it('clear sobre store vacío no lanza', async () => {
    await expect(clearSessionId()).resolves.toBeUndefined();
  });
});
