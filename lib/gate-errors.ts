/**
 * Centralised mapping of backend gate responses → client actions.
 *
 * The backend put `POST /chat/generate` and `POST /builder/chat` behind
 * `[Authorize]` and now returns structured Plus-gate errors. Instead of every
 * screen re-parsing status codes and `error` strings, callers run the response
 * through `mapGateError` once and switch on the resulting `GateAction`. The UI
 * presentation lives in `useGateHandler`; the parsing lives here so it is pure
 * and trivially testable.
 *
 * Field parsing stays defensive (unknown/missing fields degrade to `null`,
 * never throw), but the names are now LOCKED against the backend contract
 * (`feat/iap-backend-tier`, documented in `Features/Billing/README.md`):
 *   - generation response → `clamped: { field, requested, applied, upsell }`
 *     (omitted entirely when nothing was clamped)
 *   - `GET /account` → `aiPlansMonth: { used, limit, resetsAt }`
 *     (`limit` omitted = unlimited, for Plus)
 */

/** 403 gate codes that lead to a Plus upsell. */
export type UpsellCode =
  | 'plan_limit_reached'
  | 'duration_requires_plus'
  | 'multicity_requires_plus'
  | 'saved_plans_limit_reached';

export type GateAction =
  /** 401 on an authenticated endpoint — a guest must register/log in. */
  | { type: 'signup_required' }
  /** 403 structured gate — show a Plus upsell with code-specific copy. */
  | {
      type: 'upsell';
      code: UpsellCode;
      used: number | null;
      limit: number | null;
      resetsAt: string | null;
      requestedDays: number | null;
      maxDays: number | null;
      plusMaxDays: number | null;
    }
  /** 429 `daily_cap_reached` — the user is ALREADY Plus. Soft throttle, NO upsell. */
  | { type: 'soft_throttle' }
  /** 429 without a gate code — generic rate limit. */
  | { type: 'rate_limit' }
  /** Anything else — fall back to the caller's generic error copy. */
  | { type: 'generic' };

/**
 * Monthly AI-plan quota, surfaced by `GET /account` as `aiPlansMonth`. Only
 * populated for free users with a concrete `limit`; Plus omits `limit`
 * (unlimited), so the parser yields `null` and the "X of N" line stays hidden.
 */
export type AiPlansQuota = { used: number; limit: number; resetsAt: string | null };

/** Hint that a generated plan's duration was clamped to the tier cap (`clamped`). */
export type ClampedHint = { appliedDays: number | null; requestedDays: number | null };

const UPSELL_CODES: readonly string[] = [
  'plan_limit_reached',
  'duration_requires_plus',
  'multicity_requires_plus',
  'saved_plans_limit_reached',
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Normalise an error code before matching: trim + lowercase, so a casing/whitespace
 * drift from the backend never silently misroutes a gate (g5). Mirrors the tolerant
 * field extraction elsewhere in this module.
 */
function normalizeCode(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  const normalized = s.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Map an API `{ status, errorBody }` pair to a client action.
 *
 * Precedence:
 *  1. `401` → `signup_required`, regardless of any code — the endpoint now
 *     requires auth, so a guest funnel must prompt login before anything else.
 *  2. A known upsell code → `upsell` (with tolerant field extraction).
 *  3. `daily_cap_reached` → `soft_throttle` (Plus user, no upsell).
 *  4. Any other `429` → `rate_limit`.
 *  5. Otherwise → `generic`.
 */
export function mapGateError(status: number, errorBody: unknown): GateAction {
  if (status === 401) return { type: 'signup_required' };

  const body = asRecord(errorBody);
  const code = body ? normalizeCode(body.error) : null;

  if (code && UPSELL_CODES.includes(code)) {
    return {
      type: 'upsell',
      code: code as UpsellCode,
      used: numOrNull(body?.used),
      limit: numOrNull(body?.limit),
      resetsAt: strOrNull(body?.resetsAt),
      requestedDays: numOrNull(body?.requestedDays),
      maxDays: numOrNull(body?.maxDays),
      plusMaxDays: numOrNull(body?.plusMaxDays),
    };
  }

  if (code === 'daily_cap_reached') return { type: 'soft_throttle' };

  if (status === 429) return { type: 'rate_limit' };

  return { type: 'generic' };
}

/**
 * Extract the monthly AI-plan quota from a `GET /account` response body.
 *
 * Locked contract: the quota lives at the top level under `aiPlansMonth` as
 * `{ used, limit, resetsAt }`. For Plus users `limit` is omitted (unlimited),
 * so `used`/`limit` won't both be numbers → returns `null` and the UI hides the
 * "X of N" line (which it only renders for free users anyway). Returns `null`
 * when absent or malformed — never throws.
 */
export function parseAiPlansQuota(accountBody: unknown): AiPlansQuota | null {
  const body = asRecord(accountBody);
  if (!body) return null;

  const raw = asRecord(body.aiPlansMonth);
  if (!raw) return null;

  const used = numOrNull(raw.used);
  const limit = numOrNull(raw.limit);
  if (used === null || limit === null) return null;

  return { used, limit, resetsAt: strOrNull(raw.resetsAt) };
}

/**
 * Detect the "duration clamped to the tier cap" hint on a generation response.
 *
 * Locked contract: `clamped: { field, requested, applied, upsell }`, present
 * only when something was actually clamped (omitted otherwise). We read the
 * day figures from `applied`/`requested`. Returns `null` when there is no clamp.
 */
export function parseClampedHint(generateBody: unknown): ClampedHint | null {
  const body = asRecord(generateBody);
  if (!body) return null;

  const clamped = asRecord(body.clamped);
  if (!clamped) return null;

  return {
    appliedDays: numOrNull(clamped.applied),
    requestedDays: numOrNull(clamped.requested),
  };
}
