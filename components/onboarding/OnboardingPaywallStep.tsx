import React from 'react';
import { PaywallView } from '../paywall/PaywallView';

/**
 * Paso 5 del onboarding: el paywall timeline como último paso, tras el preview y
 * ANTES de completar (W5). REUTILIZA `PaywallView` — la misma máquina de
 * compra/oferta/elegibilidad de la ruta `paywall`, sin duplicar nada — cableada
 * a las salidas del onboarding:
 *
 *  - `onBack`  → la X y el back físico Android retroceden al preview (no es un
 *                dead-end; el orquestador ya mapea el back de hardware a step-1).
 *  - `onSkip`  → "Ahora no": completa el onboarding con `skippedPaywall:true`.
 *                Es también el destino del AUTO-SALTO por degradación
 *                (`autoSkipOnUnavailable`): si RevenueCat no está configurado o
 *                no hay ofertas, el paso se salta solo, limpio, sin atrapar a
 *                nadie en un paywall roto.
 *  - `onPurchased` → una compra/restore efectivo completa el onboarding con
 *                `skippedPaywall:false`.
 *
 * El framing de trial NO se pinta a no-elegibles: lo garantiza el mismo
 * `effectiveEligibility` de `PaywallView`, no se reimplementa aquí.
 */

interface OnboardingPaywallStepProps {
  /** Back físico / X → retrocede al preview (step 4). No completa el flujo. */
  onBack: () => void;
  /** "Ahora no" / auto-salto por degradación → completa con skippedPaywall:true. */
  onSkip: () => void;
  /** Compra o restore efectivo → completa con skippedPaywall:false. */
  onPurchased: () => void;
}

export function OnboardingPaywallStep({ onBack, onSkip, onPurchased }: OnboardingPaywallStepProps) {
  return (
    <PaywallView
      source="onboarding"
      onClose={onBack}
      onSkip={onSkip}
      onDone={onPurchased}
      autoSkipOnUnavailable
    />
  );
}
