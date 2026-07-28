/**
 * `days_since_install` for the `app_opened` event.
 *
 * The first-open timestamp is persisted the SAME way `lib/analytics.ts` persists
 * the anon id: a plain file in the app's document directory (expo-file-system).
 * Semantics chosen on purpose — it survives restarts/updates but DIES on
 * uninstall (never Keychain/SecureStore, which would outlive a reinstall and act
 * as a non-resettable device id). The first ever open initializes the file and
 * reports 0 days.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../logger';

const FIRST_OPEN_FILE = `${FileSystem.documentDirectory ?? ''}analytics_first_open`;
const DAY_MS = 86_400_000;

/** Whole days between the persisted first-open and now. Never negative. */
export function daysSinceInstall(firstOpenMs: number, nowMs: number): number {
  const diff = Math.floor((nowMs - firstOpenMs) / DAY_MS);
  return diff > 0 ? diff : 0;
}

/**
 * Memoized so concurrent cold-start callers share one read (and one init if the
 * file did not exist). A REJECTION is not memoized: the promise resets so the
 * next call retries storage, and meanwhile this open is treated as the install
 * moment (returns `now` → 0 days). Mirrors the anon-id pattern in analytics.ts.
 */
let _firstOpenPromise: Promise<number> | null = null;

export function readOrInitFirstOpen(now: number = Date.now()): Promise<number> {
  if (!_firstOpenPromise) {
    _firstOpenPromise = (async () => {
      const info = await FileSystem.getInfoAsync(FIRST_OPEN_FILE);
      if (info.exists) {
        const raw = (await FileSystem.readAsStringAsync(FIRST_OPEN_FILE)).trim();
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      // First ever open (or a corrupt value): persist now, fire-and-forget.
      FileSystem.writeAsStringAsync(FIRST_OPEN_FILE, String(now)).catch((err) =>
        logger.debug('analytics: first-open persist failed', err),
      );
      return now;
    })().catch((err) => {
      logger.debug('analytics: first-open load failed', err);
      _firstOpenPromise = null;
      return now; // storage down → treat this open as the install moment
    });
  }
  return _firstOpenPromise;
}

/** Reads (or initializes) the first-open timestamp and returns whole days since. */
export async function getDaysSinceInstall(now: number = Date.now()): Promise<number> {
  const firstOpen = await readOrInitFirstOpen(now);
  return daysSinceInstall(firstOpen, now);
}
