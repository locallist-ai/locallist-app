import * as SecureStore from './safe-store';

const SESSION_KEY = 'locallist_chat_session_id';

export async function getSavedSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function saveSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, sessionId);
}

export async function clearSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
