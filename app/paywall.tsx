import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PaywallView } from '../components/paywall/PaywallView';
import type { PaywallSource } from '../lib/analytics';

/**
 * Pantalla de paywall (ruta `paywall`). Es una envoltura FINA sobre
 * `PaywallView`: toda la máquina de compra/oferta/elegibilidad vive en el
 * componente reutilizable (lo comparte el paso 5 del onboarding, W5). Aquí solo
 * se resuelve el `source` del deep link/push y se cablea el cierre a la
 * navegación (`router.back()`). NO hay skip ni auto-salto: en esta superficie el
 * paywall se cierra con la X (o el estado "no disponible" con reintento).
 */

const PAYWALL_SOURCES: readonly PaywallSource[] = [
  'account_upsell', 'plan_limit', 'day_limit', 'multi_city',
  'offline_follow', 'favorites_limit', 'video_import', 'settings',
  'onboarding',
];

/** `?source=` del deep link/push validado contra la taxonomía; default upsell. */
function asPaywallSource(raw: string | string[] | undefined): PaywallSource {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (PAYWALL_SOURCES as readonly string[]).includes(value ?? '')
    ? (value as PaywallSource)
    : 'account_upsell';
}

export default function PaywallScreen() {
  const params = useLocalSearchParams<{ source?: string }>();
  const source = asPaywallSource(params.source);
  return <PaywallView source={source} onClose={() => router.back()} />;
}
