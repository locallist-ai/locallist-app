/**
 * Lightweight PostHog analytics — uses the REST capture API directly (no native SDK,
 * no rebuild required). All calls are fire-and-forget; errors are silent in prod.
 *
 * Enable by setting EXPO_PUBLIC_POSTHOG_KEY in .env. Without the key, every call
 * is a no-op.
 */
import { logger } from './logger';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let _distinctId: string | null = null;

export function setAnalyticsUserId(id: string | null) {
  _distinctId = id;
}

export type AppEvent =
  // Auth
  | { event: 'sign_up'; provider: 'apple' | 'google' | 'email' }
  | { event: 'sign_in'; provider: 'apple' | 'google' | 'email' }
  // Content
  | { event: 'plan_viewed'; planId: string; source?: 'feed' | 'builder' | 'deep_link' }
  | { event: 'place_viewed'; placeId: string; planId?: string }
  // Builder
  | { event: 'wizard_started'; city?: string }
  | { event: 'wizard_completed'; planId: string; city: string; days: number }
  // Follow Mode
  | { event: 'follow_started'; planId: string }
  | { event: 'follow_completed'; planId: string; stopsCompleted: number }
  // Chat builder
  | { event: 'chat_started'; sessionId: string | null }
  | { event: 'chat_turn'; sessionId: string; turnCount: number; slotsFilled: number; totalSlots: number }
  | { event: 'chat_ready'; sessionId: string; turnCount: number }
  | { event: 'chat_generated'; sessionId: string; planId: string; turnCount: number }
  | { event: 'chat_abandoned'; sessionId: string; turnCount: number }
  | { event: 'chat_to_wizard_escape'; sessionId: string | null; turnCount: number }
  // Profile
  | { event: 'profile_saved'; fields: string[] }
  | { event: 'profile_reset' };

/** @deprecated Use AppEvent */
export type ChatEvent = AppEvent;

export function track(payload: AppEvent): void {
  if (!POSTHOG_KEY) return;
  const { event, ...properties } = payload;
  const body = JSON.stringify({
    api_key: POSTHOG_KEY,
    event,
    distinct_id: _distinctId ?? 'anonymous',
    properties: {
      ...properties,
      $lib: 'locallist-app',
    },
  });
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch((err) => logger.debug('analytics: capture failed', err));
}

export function countFilledSlots(slots: {
  city: unknown; days: unknown; groupType: unknown;
  categories: unknown; budget: unknown; pace: unknown;
  dietary: unknown; exclusions: unknown; vibesPrimary: unknown;
}): number {
  return Object.values(slots).filter((v) => {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
}
