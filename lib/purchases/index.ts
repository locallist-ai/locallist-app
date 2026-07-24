/**
 * RevenueCat (Apple IAP) — barrel del subsistema "LocalList Plus".
 *
 * Re-exporta EXACTAMENTE la API pública histórica de `lib/purchases`, ahora
 * partida por responsabilidad en dos módulos internos:
 *  - `./config`   → núcleo de identidad/configuración (estado, cola, época,
 *                   guarda TOCTOU, configure/logout, caché de storefront).
 *  - `./offerings`→ offerings, elegibilidad de trial, compra/restore, poll de
 *                   tier y listener de activación.
 *
 * Los consumidores siguen importando `from '../lib/purchases'` sin cambios. El
 * estado mutable y las primitivas de cola son internos (accesibles solo por
 * `./offerings`, no re-exportados aquí): la superficie pública no se amplía.
 */
export {
  isPurchasesConfigured,
  getCachedStorefront,
  configurePurchases,
  logOutPurchases,
  resetPurchasesForTesting,
} from './config';

export {
  PLUS_ENTITLEMENT_ID,
  getPlusOfferings,
  checkTrialEligibility,
  addPlusActivationListener,
  purchasePlusPackage,
  restorePlusPurchases,
} from './offerings';

export type {
  OfferingsError,
  OfferingsResult,
  TrialEligibilityStatus,
  RefreshAccountTier,
  PlusEntitlementPeriodType,
  PurchaseOutcome,
} from './offerings';
