/**
 * Provenance of a plan-detail view, for the `plan_viewed` funnel. NO ids/PII —
 * only where the user came from.
 *
 *  - `wizard`  : builder preview from the AI wizard (`/plan/preview`).
 *  - `chat`    : plan generated in the conversational chat builder.
 *  - `import`  : plan created from a video/photo import.
 *  - `shared`  : opened from a shared deep link.
 *  - `curated` : an editorially-curated plan (Plans tab / onboarding showcase).
 *  - `mine`    : one of the user's own saved plans.
 *  - `unknown` : source could not be determined from the route.
 */
export type PlanViewSource =
  | 'wizard'
  | 'chat'
  | 'import'
  | 'shared'
  | 'curated'
  | 'mine'
  | 'unknown';

const VALID_SOURCES: readonly PlanViewSource[] = [
  'wizard',
  'chat',
  'import',
  'shared',
  'curated',
  'mine',
  'unknown',
];

/**
 * Derives the `plan_viewed` source from the route params available at
 * `app/plan/[id].tsx`. An explicit, valid `source` query param wins; otherwise
 * the `/plan/preview` sentinel identifies a wizard preview; anything else is
 * `unknown`. Pure — no id/PII ever leaves this function.
 */
export function derivePlanViewSource(params: {
  id?: string;
  source?: string | string[];
}): PlanViewSource {
  const raw = Array.isArray(params.source) ? params.source[0] : params.source;
  if (raw && (VALID_SOURCES as readonly string[]).includes(raw)) {
    return raw as PlanViewSource;
  }
  // The wizard is the only flow that lands on the `preview` sentinel route.
  if (params.id === 'preview') return 'wizard';
  return 'unknown';
}
