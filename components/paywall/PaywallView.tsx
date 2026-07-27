import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import type { PaywallSource } from '../../lib/analytics';
import { ConfirmModal } from '../ui/ConfirmModal';
import { TrialTimeline } from './TrialTimeline';
import { usePaywallController, eligibleTrialDays } from './usePaywallController';

/**
 * Cuerpo REUTILIZABLE del paywall: la vista que consume `usePaywallController`
 * (toda la máquina de fases: load / compra / restore / elegibilidad de trial).
 * Extraída de la pantalla `app/paywall.tsx` para que la comparta también el paso
 * 5 del onboarding (W5). La navegación NO se hardcodea a `router` — se inyecta
 * por callbacks — así este componente funciona igual DENTRO de un navegador (la
 * ruta `paywall`) que FUERA (el onboarding se renderiza en el gate de entrada,
 * sin navegador montado).
 *
 * La maquinaria de compra/identidad blindada (`lib/purchases.ts`) NO se toca: se
 * consume tal cual desde el controlador. El gating de elegibilidad
 * (`effectiveEligibility`) es el mismo, así que el framing de trial jamás se
 * pinta a un no-elegible en ninguna de las dos superficies — sin reimplementar
 * el gating por sitio.
 */

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

export interface PaywallViewProps {
  /** Entrada del funnel (taxonomía de PaywallSource): tag de paywall_viewed. */
  source: PaywallSource;
  /**
   * Cierre/back del paywall SIN outcome de compra: la X de arriba, y (en las
   * fases de éxito/pending, si no hay `onDone`) el botón de terminar. En la ruta
   * standalone es `router.back()`; en el onboarding retrocede al preview.
   */
  onClose: () => void;
  /**
   * "Ahora no" / saltar (onboarding). Cuando se pasa, se pinta el botón de skip
   * en la fase `ready` y es el destino del auto-salto por degradación. En la
   * ruta standalone se omite (no hay skip: el paywall se cierra con la X).
   */
  onSkip?: () => void;
  /**
   * Terminar tras un outcome de compra/restore efectivo (éxito o pending). En el
   * onboarding completa el flujo con `skippedPaywall:false`; en standalone se
   * omite y cae a `onClose` (cerrar la pantalla) — comportamiento idéntico al
   * `router.back()` original.
   */
  onDone?: () => void;
  /**
   * Degradación limpia (onboarding): si el paywall no puede mostrarse (RC sin
   * configurar / sin ofertas) auto-salta vía `onSkip` en vez de mostrar el
   * estado "no disponible" con reintento. Nadie queda atrapado en un paso de
   * paywall roto. En standalone se omite: ahí SÍ se muestra el retry.
   */
  autoSkipOnUnavailable?: boolean;
}

export function PaywallView({ source, onClose, onSkip, onDone, autoSkipOnUnavailable }: PaywallViewProps) {
  const { t } = useTranslation();
  const packageLabel = usePackageLabel();
  const {
    phase,
    packages,
    selected,
    setSelected,
    busy,
    modal,
    setModal,
    trialReminderApplies,
    effectiveEligibility,
    selectedTrialDays,
    noticeChargeDay,
    onPurchase,
    onRestore,
    onCheckPending,
    load,
    done,
    closeAction,
  } = usePaywallController({ source, onClose, onSkip, onDone, autoSkipOnUnavailable });

  return (
    <View style={s.root}>
      {/* Close */}
      <TouchableOpacity style={s.closeBtn} activeOpacity={0.7} onPress={closeAction} testID="paywall-close">
        <Ionicons name="close" size={22} color={colors.deepOcean} />
      </TouchableOpacity>

      {phase === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.electricBlue} />
        </View>
      )}

      {/* Degradación: en onboarding (autoSkipOnUnavailable) el estado
          "no disponible" no se pinta — el effect ya sale por onSkip, así no
          hay flash de un paywall roto ni retry sin sentido. */}
      {phase === 'unavailable' && !autoSkipOnUnavailable && (
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
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.8} onPress={done} testID="paywall-done">
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
          <TouchableOpacity onPress={done}>
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
              ['videocam-outline', t('paywall.featureImport')],
              ['heart-outline', t('paywall.featureFavorites')],
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

          {/* Skip / "Ahora no" (solo onboarding): saltar el paso sin comprar.
              En standalone no se pasa `onSkip` ⇒ no se pinta. */}
          {onSkip && (
            <TouchableOpacity onPress={onSkip} disabled={busy} testID="paywall-skip">
              <Text style={s.skipText}>{t('paywall.notNow')}</Text>
            </TouchableOpacity>
          )}

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
  // "Ahora no" del onboarding: menos peso visual que restore/CTA (secundario
  // neutro), para que saltar sea posible pero no compita con la compra.
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
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
