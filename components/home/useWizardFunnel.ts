import { useCallback, useEffect, useRef } from 'react';
import { track } from '../../lib/analytics';

/**
 * Wizard funnel instrumentation, extracted so it can be unit-tested in isolation
 * from the heavy `useWizard` hook.
 *
 *  - `wizard_step_viewed` fires whenever the visible wizard `step` changes
 *    (including the initial mount) — the funnel denominator.
 *  - `wizard_abandoned` fires ONCE on unmount with the last-visible step, UNLESS
 *    the caller signalled a successful generate via `markGenerated()`. The
 *    success path must never emit abandon: once generated, the flag suppresses
 *    the abandon-on-unmount for the rest of the component's life (the wizard
 *    route stays mounted under the pushed preview and only unmounts later).
 */
export function useWizardFunnel(step: number): { markGenerated: () => void } {
  const generatedRef = useRef(false);
  const stepRef = useRef(step);

  // Fire on every step change (and once on mount). Keep the last-seen step for
  // the abandon payload.
  useEffect(() => {
    stepRef.current = step;
    track({ event: 'wizard_step_viewed', step });
  }, [step]);

  // Abandon-on-unmount, suppressed by a prior successful generate.
  useEffect(() => {
    return () => {
      if (!generatedRef.current) {
        track({ event: 'wizard_abandoned', step: stepRef.current });
      }
    };
  }, []);

  const markGenerated = useCallback(() => {
    generatedRef.current = true;
  }, []);

  return { markGenerated };
}
