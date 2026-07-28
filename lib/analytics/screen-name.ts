/**
 * Normalizes an Expo Router pathname into a low-cardinality screen pattern for
 * the `screen_view` event. Dynamic segments after a known dynamic parent
 * (`/plan/abc` → `/plan/[id]`) collapse to `[id]` so no id/PII is ever sent and
 * the analytics cardinality stays bounded.
 */

/** Route parents whose FOLLOWING path segment is a dynamic id. */
const DYNAMIC_PARENTS = new Set(['plan', 'follow', 'place']);

export function normalizeScreen(pathname: string): string {
  // Drop query string / hash and any trailing slash.
  const clean = (pathname.split(/[?#]/)[0] || '/').replace(/\/+$/, '');
  if (clean === '' || clean === '/') return '/';

  const parts = clean.split('/').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(parts[i]);
    if (DYNAMIC_PARENTS.has(parts[i]) && i + 1 < parts.length) {
      out.push('[id]');
      i += 1; // skip the concrete id segment
    }
  }
  return '/' + out.join('/');
}
