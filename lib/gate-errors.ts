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
 * Field parsing is deliberately TOLERANT: the exact field names of the gate
 * catalogue are still being finalised with the API task (api-gates-fixes.md).
 * Unknown/missing fields degrade to `null`, never throw. See the TODOs below
 * for the specific names that need locking once the backend contract is fixed.
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

/** Monthly AI-plan quota, surfaced by `GET /account` (api-gates-fixes.md m4). */
export type AiPlansQuota = { used: number; limit: number; resetsAt: string | null };

/** Hint that a generated plan's duration was clamped to the free cap (m3). */
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
  const code = body ? strOrNull(body.error) : null;

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
 * TODO(gate-api): the field name is not finalised with api-gates-fixes.md m4.
 * We accept snake_case (`ai_plans_month`) and camelCase (`aiPlansMonth`), at
 * the top level or nested under `user`. Once the backend contract is locked,
 * drop the extra candidates and keep only the real one. Returns `null` when
 * absent or malformed — the UI simply hides the quota line in that case.
 */
export function parseAiPlansQuota(accountBody: unknown): AiPlansQuota | null {
  const body = asRecord(accountBody);
  if (!body) return null;

  const user = asRecord(body.user);
  const raw =
    asRecord(body.ai_plans_month) ??
    asRecord(body.aiPlansMonth) ??
    (user ? asRecord(user.ai_plans_month) ?? asRecord(user.aiPlansMonth) : null);
  if (!raw) return null;

  const used = numOrNull(raw.used);
  const limit = numOrNull(raw.limit);
  if (used === null || limit === null) return null;

  return { used, limit, resetsAt: strOrNull(raw.resetsAt) };
}

/**
 * Detect the "duration clamped to the free cap" hint on a generation response.
 *
 * TODO(gate-api): the hint shape is not finalised with api-gates-fixes.md m3.
 * We accept either a boolean `clamped` (with day fields alongside) or an object
 * under a few candidate keys. Returns `null` when there is no clamp. Lock the
 * real shape once the backend contract is fixed.
 */
export function parseClampedHint(generateBody: unknown): ClampedHint | null {
  const body = asRecord(generateBody);
  if (!body) return null;

  const flag = body.clamped;
  if (flag === true) {
    return {
      appliedDays: numOrNull(body.appliedDays) ?? numOrNull(body.days),
      requestedDays: numOrNull(body.requestedDays),
    };
  }

  const obj = asRecord(flag) ?? asRecord(body.clampedDuration) ?? asRecord(body.duration_clamped);
  if (obj) {
    return {
      appliedDays: numOrNull(obj.appliedDays) ?? numOrNull(obj.days),
      requestedDays: numOrNull(obj.requestedDays),
    };
  }

  return null;
}
