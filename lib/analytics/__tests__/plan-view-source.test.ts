/**
 * Tests de `lib/analytics/plan-view-source.ts` — procedencia de `plan_viewed`.
 * Sin id/PII: solo el enum de source, con fallback a 'unknown'.
 */
import { derivePlanViewSource } from '../plan-view-source';

describe('derivePlanViewSource', () => {
  it('un `source` explícito y válido gana', () => {
    expect(derivePlanViewSource({ id: 'p1', source: 'chat' })).toBe('chat');
    expect(derivePlanViewSource({ id: 'p1', source: 'mine' })).toBe('mine');
    expect(derivePlanViewSource({ id: 'p1', source: 'curated' })).toBe('curated');
    expect(derivePlanViewSource({ id: 'p1', source: 'import' })).toBe('import');
    expect(derivePlanViewSource({ id: 'p1', source: 'shared' })).toBe('shared');
  });

  it('el sentinela `preview` (sin source) → wizard', () => {
    expect(derivePlanViewSource({ id: 'preview' })).toBe('wizard');
  });

  it('id real sin source → unknown', () => {
    expect(derivePlanViewSource({ id: 'plan-42' })).toBe('unknown');
  });

  it('source inválido/desconocido → unknown', () => {
    expect(derivePlanViewSource({ id: 'p1', source: 'bogus' })).toBe('unknown');
    expect(derivePlanViewSource({ id: 'p1', source: '' })).toBe('unknown');
  });

  it('un source explícito válido gana incluso sobre el sentinela preview', () => {
    expect(derivePlanViewSource({ id: 'preview', source: 'shared' })).toBe('shared');
  });

  it('acepta un source como array (Expo Router puede repetir params)', () => {
    expect(derivePlanViewSource({ id: 'p1', source: ['curated', 'x'] })).toBe('curated');
  });
});
