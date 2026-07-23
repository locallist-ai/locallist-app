import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';
import { useAuth } from '../lib/auth';
import {
  configurePurchases,
  getPlusOfferings,
  purchasePlusPackage,
  restorePlusPurchases,
  checkTrialEligibility,
} from '../lib/purchases';
import type { PlusEntitlementPeriodType, TrialEligibilityStatus } from '../lib/purchases';
import { introPriceDurationDays } from '../lib/trial-timeline';
import { track, type PaywallSource } from '../lib/analytics';
import { syncTrialReminderAfterPurchase } from '../lib/trial-reminder';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { TrialTimeline } from '../components/paywall/TrialTimeline';

/**
 * Días de trial que el paywall puede PROMETER para un package — o `null` si no
 * debe pintarse framing de trial. Exige TRES cosas, no solo el producto:
 *
 *  1. El producto OFRECE trial: intro price gratuito (`introPrice.price === 0`).
 *  2. El usuario es ELEGIBLE de verdad (`checkTrialEligibility` → 'ELIGIBLE').
 *     Apple no filtra el `introPrice` por historial de canje, así que un
 *     producto con trial se lo muestra también a quien ya lo consumió — pero a
 *     ese Apple le cobra el día 0. Solo 'ELIGIBLE' evita el trial engañoso
 *     (Apple 3.1.2 + legal); 'UNKNOWN'/'INELIGIBLE'/'NO_INTRO_OFFER' → sin
 *     framing (default seguro mientras la consulta no confirme elegibilidad).
 *  3. La duración es DERIVABLE del introPrice (días concretos para la copy).
 *
 * Devuelve los días del trial (N) — la duración se deriva, nunca se hardcodea.
 * Con `null` la fase `ready` muestra precio directo, sin timeline ni "gratis".
 */
function eligibleTrialDays(
  pkg: PurchasesPackage | null,
  eligibility: Record<string, TrialEligibilityStatus>,
): number | null {
  if (!pkg || pkg.product.introPrice?.price !== 0) return null;
  if (eligibility[pkg.product.identifier] !== 'ELIGIBLE') return null;
  return introPriceDurationDays(pkg.product.introPrice);
}

type Phase = 'loading' | 'ready' | 'unavailable' | 'success' | 'pending';

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

/**
 * Props de precio para los eventos purchase_* — todo derivado del product de
 * StoreKit (precio ya localizado). `hasTrial` = intro price gratuito (el trial
 * de 7 días del plan anual); un intro de pago no es trial. OJO: refleja el
 * PRODUCTO, no la elegibilidad del usuario (Apple puede denegar el trial a
 * quien ya lo consumió) — el cruce real trial→paid vive en los billing_events
 * del backend, no en esta prop.
 */
function purchaseEventProps(pkg: PurchasesPackage) {
  return {
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    currency: pkg.product.currencyCode,
    period: (pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly') as 'annual' | 'monthly',
    hasTrial: pkg.product.introPrice?.price === 0,
  };
}

// Etiqueta legible por tipo de package (precio localizado lo da StoreKit).
function usePackageLabel() {
  const { t } = useTranslation();
  return (pkg: PurchasesPackage): string => {
    switch (pkg.packageType) {
      case 'WEEKLY': return t('paywall.pkgWeekly');
      case 'MONTHLY': return t('paywall.pkgMonthly');
      case 'ANNUAL': return t('paywall.pkgAnnual');
      case 'LIFETIME': return t('paywall.pkgLifetime');
      default: return pkg.product.title;
    }
  };
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const { user, refreshUser, isPro } = useAuth();
  const packageLabel = usePackageLabel();
  const params = useLocalSearchParams<{ source?: string }>();
  const source = asPaywallSource(params.source);

  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  // Elegibilidad REAL de trial por productId (`checkTrialEligibility`), TAGGEADA
  // con el `user.id` para el que se resolvió. Arranca vacío ⇒ todo se trata como
  // no-elegible (precio directo) hasta que la consulta READ-ONLY confirme
  // 'ELIGIBLE'. El tag es la clave del gating sub-frame: en el render se trata el
  // mapa como VACÍO si `userId` no coincide con el `user.id` actual (ver
  // `effectiveEligibility`), así el commit del cambio de identidad ya rinde
  // precio directo SIN esperar a que `load()`/effects (passive, corren DESPUÉS
  // de ese commit) reseteen — cierra el leak de 1 frame del framing de trial.
  const [trialEligibility, setTrialEligibility] = useState<{
    userId: string | undefined;
    map: Record<string, TrialEligibilityStatus>;
  }>({ userId: undefined, map: {} });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);
  // True si la compra completada fue el plan anual con trial: las pantallas de
  // éxito/pendiente muestran el contexto del permiso ("te avisaremos antes del
  // cobro") justo cuando aparece el prompt del sistema.
  const [trialReminderApplies, setTrialReminderApplies] = useState(false);

  // paywall_viewed se emite UNA vez por apertura y SOLO cuando las offerings
  // renderizan con precios visibles (denominador de la señal de pricing) — la
  // pantalla de error ya tiene su evento (paywall_unavailable). Si un retry
  // triunfa tras un fallo, el viewed se emite entonces, anclado al éxito.
  const viewTrackedRef = useRef(false);
  // Momento en que los precios se mostraron por primera vez (msOnScreen de
  // paywall_dismissed con phase 'shown' se ancla aquí, no al mount).
  const pricesShownAtRef = useRef<number | null>(null);
  // Una compra/restore con entitlement suprime paywall_dismissed en el cierre.
  const purchaseOutcomeRef = useRef(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  // Estado vigente al desmontar (el cleanup del unmount no ve el state actual).
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  // `user.id` vigente, leído en los effects/callbacks async para taggear el mapa
  // de elegibilidad con su dueño real sin arrastrar `user` a las deps del effect
  // `[packages]` (evita re-queries espurias en cambios de user sin nuevas
  // packages). Se actualiza en cada render, así los effects lo leen ya committed.
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;
  // Guard de montaje (limpiado en el cleanup del effect del dismissed): un
  // load() que resuelve con éxito DESPUÉS del unmount no debe emitir un
  // paywall_viewed fantasma tras el dismissed — esos precios nunca renderizaron.
  const mountedRef = useRef(true);

  const trackViewedOnce = useCallback((offeringId: string | null) => {
    if (!mountedRef.current) return;
    if (pricesShownAtRef.current === null) pricesShownAtRef.current = Date.now();
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    track({ event: 'paywall_viewed', source: sourceRef.current, offeringId });
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    const configured = await configurePurchases(user?.id);
    if (!configured) {
      track({ event: 'paywall_unavailable', reason: 'not_configured' });
      setPhase('unavailable');
      return;
    }
    const { packages: pkgs, error } = await getPlusOfferings();
    if (error) {
      track({ event: 'paywall_unavailable', reason: error });
      setPhase('unavailable');
      return;
    }
    trackViewedOnce(pkgs[0]?.presentedOfferingContext?.offeringIdentifier ?? null);
    // Elegibilidad de trial: se limpia AQUÍ, en el MISMO commit que introduce
    // el nuevo array de packages (batching de React), y la re-resuelve el
    // effect [packages]. Sin este reset, un cambio de identidad con el paywall
    // ya montado (u1 ELIGIBLE → u2 INELIGIBLE) conservaría el mapa del usuario
    // anterior durante el primer paint de las nuevas packages y u2 vería el
    // framing de trial stale hasta que la nueva consulta resolviera. Con el
    // reset batched, el default seguro (mapa vacío ⇒ precio directo) rige desde
    // el PRIMER paint de las nuevas packages — nunca un paint intermedio con
    // "N días gratis" para quien no es elegible.
    setTrialEligibility({ userId: user?.id, map: {} });
    setPackages(pkgs);
    // Preselección: anual si existe (mejor precio), si no el primero.
    setSelected(pkgs.find((p) => p.packageType === 'ANNUAL') ?? pkgs[0]);
    setPhase('ready');
  }, [user?.id, trackViewedOnce]);

  useEffect(() => {
    load();
  }, [load]);

  // Elegibilidad REAL del trial. Consulta READ-ONLY al SDK (no toca la cola de
  // identidad ni StoreKit) al tener las packages: solo con status 'ELIGIBLE' el
  // paywall pinta el framing de trial. Se pregunta SOLO por productos con
  // introPrice gratuito (los que ofrecen trial). Mientras resuelve, el mapa
  // vacío mantiene el default seguro (precio directo). Un cambio de identidad
  // vuelve a cargar offerings (nuevo array de packages) y re-dispara esto.
  useEffect(() => {
    // Default seguro AL INICIO de cada ventana (incluida cada recarga por
    // cambio de identidad): mapa vacío ⇒ precio directo. Refuerza el reset
    // batched de load() para que ninguna consulta en vuelo herede la
    // elegibilidad del array de packages anterior — el framing de trial jamás
    // sobrevive a un cambio de packages mientras la nueva consulta resuelve.
    const owner = userIdRef.current;
    setTrialEligibility({ userId: owner, map: {} });
    const trialProductIds = packages
      .filter((p) => p.product.introPrice?.price === 0)
      .map((p) => p.product.identifier);
    if (trialProductIds.length === 0) {
      return;
    }
    let active = true;
    void checkTrialEligibility(trialProductIds).then((map) => {
      // Se taggea con el `user.id` de ESTA ventana; si la identidad ya cambió,
      // `active` es false (cleanup del cambio de packages) y no se aplica.
      if (active) setTrialEligibility({ userId: owner, map });
    });
    return () => {
      active = false;
    };
  }, [packages]);

  // Funnel view→dismiss: al desmontar (X, back, swipe-down del modal) sin
  // outcome de compra se emite paywall_dismissed con la phase vigente. Un
  // dismissed con phase 'loading'/'unavailable' no lleva viewed emparejado:
  // correcto, el usuario nunca vio precios.
  useEffect(() => {
    const mountedAt = Date.now();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (purchaseOutcomeRef.current) return;
      const dismissPhase =
        phaseRef.current === 'ready'
          ? ('shown' as const)
          : phaseRef.current === 'unavailable'
            ? ('unavailable' as const)
            : ('loading' as const);
      const since =
        dismissPhase === 'shown' && pricesShownAtRef.current !== null
          ? pricesShownAtRef.current
          : mountedAt;
      track({
        event: 'paywall_dismissed',
        source: sourceRef.current,
        phase: dismissPhase,
        msOnScreen: Date.now() - since,
      });
    };
  }, []);

  // Reconciliación en caliente: si el tier flipa a 'pro' mientras esperamos en el
  // estado pending (el listener a nivel de app refrescó /account al llegar el
  // webhook retrasado), avanzamos a éxito sin que el usuario tenga que reintentar.
  useEffect(() => {
    if (phase === 'pending' && isPro) setPhase('success');
  }, [phase, isPro]);

  // Reintento manual desde el estado pending: vuelve a preguntar al backend.
  const onCheckPending = async () => {
    if (busy) return;
    setBusy(true);
    const tier = await refreshUser();
    setBusy(false);
    if (tier === 'pro') setPhase('success');
  };

  const onPurchase = async () => {
    if (!selected || busy || !user?.id) return;
    const props = purchaseEventProps(selected);
    setBusy(true);
    track({ event: 'purchase_started', ...props });
    // user.id como identidad esperada: la lib rechaza la compra si el SDK no
    // está asociado exactamente a este usuario (identity_mismatch).
    const outcome = await purchasePlusPackage(selected, user.id, refreshUser);
    setBusy(false);

    // Promesa "recordatorio el día 5": tras una compra efectiva del plan anual
    // con trial REAL se programa la notificación local (el módulo pide el
    // permiso en este momento, con el contexto en pantalla — nunca en el
    // arranque). El criterio es `entitlementPeriodType === 'TRIAL'` del
    // outcome (elegibilidad del USUARIO), no el introPrice del producto: a
    // quien ya consumió su trial Apple le cobra ya, y avisarle de "tu prueba
    // acaba" sería mentira. Una compra efectiva SIN trial cancela cualquier
    // aviso pendiente obsoleto (cambio de plan durante el trial).
    // Fire-and-forget: nunca lanza y no puede romper el flujo de compra.
    const syncReminder = (
      entitlementPeriodType: PlusEntitlementPeriodType | null,
      outcomeStatus: 'success' | 'pending_backend',
    ) => {
      // Duración del trial DERIVADA de la MISMA fuente que el display del
      // timeline (`introPriceDurationDays` del introPrice del producto): aviso y
      // cobro se mueven con ella, nunca con una constante hardcodeada.
      const derivedTrialDays = introPriceDurationDays(selected.product.introPrice);
      const isRealTrial =
        selected.packageType === 'ANNUAL' && entitlementPeriodType === 'TRIAL';
      // Config degenerada (imposible con ASC normal, por eso no era CRITICAL):
      // entitlement TRIAL pero la duración del introPrice NO es interpretable
      // (`periodUnit`/`periodNumberOfUnits` desconocidos ⇒ null). Fail-safe: no
      // programar un recordatorio con día inventado (el default de negocio de 7d
      // mentiría sobre una duración que no conocemos) NI pintar el aviso con día
      // en blanco. No notificar es mejor que notificar mal.
      const degenerateTrial = isRealTrial && derivedTrialDays === null;
      setTrialReminderApplies(isRealTrial && derivedTrialDays !== null);
      if (degenerateTrial) return;
      void syncTrialReminderAfterPurchase({
        packageType: selected.packageType,
        entitlementPeriodType,
        outcomeStatus,
        purchasedAt: new Date(),
        // `null` aquí solo llega para compras SIN trial real (cancel_stale), donde
        // `trialDays` no se usa: el scheduler nunca programa con el default fantasma.
        trialDays: derivedTrialDays ?? undefined,
      });
    };

    switch (outcome.status) {
      case 'success':
        purchaseOutcomeRef.current = true;
        track({ event: 'purchase_completed', ...props, pendingBackend: false });
        syncReminder(outcome.entitlementPeriodType, outcome.status);
        setPhase('success');
        break;
      case 'pending_backend':
        purchaseOutcomeRef.current = true;
        track({ event: 'purchase_completed', ...props, pendingBackend: true });
        syncReminder(outcome.entitlementPeriodType, outcome.status);
        setPhase('pending');
        break;
      case 'cancelled':
        // Cancelar el sheet de Apple no es un error: sin modal, sin log.
        track({ event: 'purchase_cancelled', ...props });
        break;
      default:
        track({ event: 'purchase_failed', ...props });
        if (outcome.status === 'error' && outcome.message === 'identity_mismatch') {
          // La identidad RC quedó invalidada (divergencia/carrera): un re-load
          // re-configura (logIn fresco) y refetch — re-pulsar comprar vuelve a
          // funcionar en vez de repetir el mismatch hasta salir de la pantalla.
          await load();
          break;
        }
        setModal({ title: t('paywall.errorTitle'), body: t('paywall.errorBody') });
    }
  };

  const onRestore = async () => {
    if (busy || !user?.id) return;
    setBusy(true);
    const outcome = await restorePlusPurchases(user.id, refreshUser);
    setBusy(false);

    switch (outcome.status) {
      case 'success':
        purchaseOutcomeRef.current = true;
        track({ event: 'restore_completed', found: true });
        setPhase('success');
        break;
      case 'pending_backend':
        purchaseOutcomeRef.current = true;
        track({ event: 'restore_completed', found: true });
        setPhase('pending');
        break;
      case 'no_entitlement':
        track({ event: 'restore_completed', found: false });
        setModal({ title: t('paywall.restoreNoneTitle'), body: t('paywall.restoreNoneBody') });
        break;
      default:
        if (outcome.status === 'error' && outcome.message === 'identity_mismatch') {
          // Misma recuperación que en la compra: re-configure + refetch.
          await load();
          break;
        }
        setModal({ title: t('paywall.errorTitle'), body: t('paywall.errorBody') });
    }
  };

  // Elegibilidad EFECTIVA para este render: el mapa se trata como VACÍO si el
  // `user.id` con que se pobló no coincide con el actual. Se resetea en el MISMO
  // render que el cambio de identidad (no en un passive effect posterior), así
  // el commit del cambio de contexto ya rinde precio directo (default seguro) y
  // un no-elegible NUNCA ve el framing de trial del usuario anterior, ni un frame.
  const effectiveEligibility =
    trialEligibility.userId === user?.id ? trialEligibility.map : {};

  // Timeline solo con trial que el usuario PUEDE canjear (producto con trial +
  // status 'ELIGIBLE'); `null` ⇒ precio directo. Los días salen derivados.
  const selectedTrialDays = eligibleTrialDays(selected, effectiveEligibility);

  // Día del primer cobro para el aviso post-compra (éxito/pending): derivado del
  // trial del package elegido (N+1), nunca hardcodeado a "día 8".
  const noticeChargeDay = useMemo(() => {
    const days = selected ? introPriceDurationDays(selected.product.introPrice) : null;
    return days === null ? null : days + 1;
  }, [selected]);

  return (
    <View style={s.root}>
      {/* Close */}
      <TouchableOpacity style={s.closeBtn} activeOpacity={0.7} onPress={() => router.back()} testID="paywall-close">
        <Ionicons name="close" size={22} color={colors.deepOcean} />
      </TouchableOpacity>

      {phase === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.electricBlue} />
        </View>
      )}

      {phase === 'unavailable' && (
        <View style={s.center}>
          <View style={s.stateIcon}>
            <Ionicons name="cart-outline" size={40} color={colors.textSecondary} />
          </View>
          <Text style={s.stateTitle}>{t('paywall.unavailableTitle')}</Text>
          <Text style={s.stateBody}>{t('paywall.unavailableBody')}</Text>
          <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.8} onPress={load}>
            <Text style={s.secondaryBtnText}>{t('paywall.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'success' && (
        <View style={s.center}>
          <View style={[s.stateIcon, s.stateIconSuccess]}>
            <Ionicons name="checkmark" size={40} color={colors.successEmerald} />
          </View>
          <Text style={s.stateTitle}>{t('paywall.successTitle')}</Text>
          <Text style={s.stateBody}>{t('paywall.successBody')}</Text>
          {trialReminderApplies && noticeChargeDay != null && (
            <Text style={s.trialNotice} testID="paywall-trial-notice">
              {t('paywall.trialReminderNotice', { day: noticeChargeDay })}
            </Text>
          )}
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={s.primaryBtnText}>{t('paywall.done')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'pending' && (
        <View style={s.center}>
          <View style={[s.stateIcon, s.stateIconSuccess]}>
            <Ionicons name="hourglass-outline" size={40} color={colors.successEmerald} />
          </View>
          <Text style={s.stateTitle}>{t('paywall.pendingTitle')}</Text>
          <Text style={s.stateBody}>{t('paywall.pendingBody')}</Text>
          {trialReminderApplies && noticeChargeDay != null && (
            <Text style={s.trialNotice} testID="paywall-trial-notice">
              {t('paywall.trialReminderNotice', { day: noticeChargeDay })}
            </Text>
          )}
          <TouchableOpacity
            style={[s.primaryBtn, busy && s.primaryBtnDisabled]}
            activeOpacity={0.8}
            onPress={onCheckPending}
            disabled={busy}
            testID="paywall-pending-retry"
          >
            {busy
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.primaryBtnText}>{t('paywall.pendingRetry')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => WebBrowser.openBrowserAsync('https://locallist.ai/support')}
            testID="paywall-pending-contact"
          >
            <Text style={s.restoreText}>{t('paywall.pendingContact')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.restoreText}>{t('paywall.done')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'ready' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header — sin urgencia, solo la promesa */}
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Ionicons name="sparkles" size={26} color={colors.electricBlue} />
            </View>
            <Text style={s.headerTitle}>{t('paywall.title')}</Text>
            <Text style={s.headerSubtitle}>{t('paywall.subtitle')}</Text>
          </View>

          {/* Selección de plan: precio facturado como elemento dominante; el
              "gratis" queda subordinado (verbatim de Apple 3.1.2). */}
          <View style={s.packages}>
            {packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              // "N días gratis" solo si ESTE usuario puede canjear el trial de
              // ESTE producto; N derivado, no literal.
              const pkgTrialDays = eligibleTrialDays(pkg, effectiveEligibility);
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[s.pkgCard, isSelected && s.pkgCardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelected(pkg)}
                  testID={`paywall-pkg-${pkg.identifier}`}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? colors.electricBlue : colors.borderColor}
                  />
                  <View style={s.pkgInfo}>
                    <View style={s.pkgLabelRow}>
                      <Text style={s.pkgLabel}>{packageLabel(pkg)}</Text>
                      {pkg.packageType === 'ANNUAL' && (
                        <View style={s.bestValueBadge}>
                          <Text style={s.bestValueText}>{t('paywall.bestValue')}</Text>
                        </View>
                      )}
                    </View>
                    {pkgTrialDays !== null && (
                      <Text style={s.pkgTrial}>{t('paywall.trialFreeBadge', { days: pkgTrialDays })}</Text>
                    )}
                  </View>
                  <Text style={[s.pkgPrice, isSelected && s.pkgPriceSelected]}>
                    {pkg.product.priceString}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Timeline SOLO con trial que el usuario elegible puede canjear; con
              un plan sin trial o un usuario no elegible la zona muta a precio
              directo (no se pinta nada extra: el precio del plan ya manda). La
              duración va derivada del introPrice, no hardcodeada. */}
          {selected && selectedTrialDays !== null && (
            <TrialTimeline trialDays={selectedTrialDays} priceString={selected.product.priceString} />
          )}

          {/* Qué incluye — comprimido a 3 bullets bajo el timeline, no hero */}
          <View style={s.features}>
            {([
              ['map-outline', t('paywall.featurePlans')],
              ['flash-outline', t('paywall.featurePriority')],
              ['diamond-outline', t('paywall.featureCurated')],
            ] as const).map(([icon, label]) => (
              <View key={icon} style={s.featureRow}>
                <Ionicons name={icon} size={16} color={colors.electricBlue} />
                <Text style={s.featureText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.primaryBtn, busy && s.primaryBtnDisabled]}
            activeOpacity={0.8}
            onPress={onPurchase}
            disabled={busy}
            testID="paywall-cta"
          >
            {busy
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.primaryBtnText}>{t('paywall.cta')}</Text>}
          </TouchableOpacity>

          {/* Restore */}
          <TouchableOpacity onPress={onRestore} disabled={busy} testID="paywall-restore">
            <Text style={s.restoreText}>{t('paywall.restore')}</Text>
          </TouchableOpacity>

          <Text style={s.disclaimer}>{t('paywall.disclaimer')}</Text>

          {/* Legal — mismos destinos que SettingsSection, in-app */}
          <View style={s.legalRow}>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync('https://locallist.ai/privacy')}>
              <Text style={s.legalLink}>{t('account.privacyPolicy')}</Text>
            </TouchableOpacity>
            <Text style={s.legalDot}>·</Text>
            <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync('https://locallist.ai/terms')}>
              <Text style={s.legalLink}>{t('account.termsOfService')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Error / restore-none */}
      <ConfirmModal
        visible={!!modal}
        icon="alert-circle-outline"
        iconColor={colors.error}
        title={modal?.title ?? ''}
        body={modal?.body ?? ''}
        confirmLabel={t('paywall.close')}
        onCancel={() => setModal(null)}
        onConfirm={() => setModal(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },

  // Header (sin gradiente/urgencia)
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.electricBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: colors.deepOcean,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Features (comprimidas, bajo el timeline)
  features: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Packages
  packages: { gap: spacing.sm, marginBottom: spacing.lg },
  pkgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
  },
  pkgCardSelected: { borderColor: colors.electricBlue },
  pkgInfo: { flex: 1, gap: 2 },
  pkgLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
  },
  pkgTrial: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  bestValueBadge: {
    backgroundColor: colors.sunsetOrangeLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  bestValueText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
  },
  // El precio es el elemento más prominente; el seleccionado, aún mayor.
  pkgPrice: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.deepOcean,
  },
  pkgPriceSelected: {
    fontSize: 26,
    color: colors.electricBlue,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: colors.electricBlue,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
  secondaryBtn: {
    marginTop: spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bgCard,
  },
  secondaryBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.electricBlue },
  restoreText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.electricBlue,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legalLink: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalDot: { color: colors.textSecondary, fontSize: 12 },

  // State views (unavailable / success / pending)
  stateIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stateIconSuccess: { backgroundColor: '#d1fae5' },
  stateTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stateBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  trialNotice: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
});
