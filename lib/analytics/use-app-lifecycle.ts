import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { track } from '../analytics';
import { getDaysSinceInstall } from './app-open';
import { normalizeScreen } from './screen-name';

/**
 * `app_opened` on cold start AND on every real return from background. A real
 * background→foreground trip must pass through `'background'`; a Control Center /
 * Notification Center peek only flickers `active→inactive→active` (never
 * `'background'`). We track a `wasBackgrounded` flag so a peek does NOT count as
 * a new open. `days_since_install` comes from the persisted first-open timestamp
 * (see app-open) — 0 on the very first open.
 */
export function useAppOpenTracking(): void {
  const wasBackgrounded = useRef(false);
  useEffect(() => {
    const fire = () => {
      void getDaysSinceInstall().then((days) =>
        track({ event: 'app_opened', days_since_install: days }),
      );
    };
    fire(); // cold start (exactly once)
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        wasBackgrounded.current = true;
      } else if (next === 'active' && wasBackgrounded.current) {
        wasBackgrounded.current = false;
        fire();
      }
    });
    return () => sub.remove();
  }, []);
}

/**
 * `screen_view` on every Expo Router route change. `usePathname()` + the
 * `[pathname]` dep already fire once per DISTINCT pathname, so no extra dedupe is
 * needed — and deduping on the normalized name would wrongly collapse
 * cross-resource navigation (`/plan/A → /plan/B`, both `/plan/[id]`) into a
 * single event. The payload carries the normalized low-cardinality pattern
 * (dynamic ids → `[id]`, query/hash stripped); the raw id never leaves the app.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  useEffect(() => {
    track({ event: 'screen_view', screen: normalizeScreen(pathname) });
  }, [pathname]);
}
