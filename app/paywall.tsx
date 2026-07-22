import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../lib/purchases';
import { track } from '../lib/analytics';
import { ConfirmModal } from '../components/ui/ConfirmModal';

type Phase = 'loading' | 'ready' | 'unavailable' | 'success' | 'pending';

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

  const [phase, setPhase] = useState<Phase>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);

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
    setPackages(pkgs);
    // Preselección: anual si existe (mejor precio), si no el primero.
    setSelected(pkgs.find((p) => p.packageType === 'ANNUAL') ?? pkgs[0]);
    setPhase('ready');
  }, [user?.id]);

  useEffect(() => {
    track({ event: 'paywall_viewed', source: 'account_upsell' });
    load();
  }, [load]);

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
    const productId = selected.product.identifier;
    setBusy(true);
    track({ event: 'purchase_started', productId });
    // user.id como identidad esperada: la lib rechaza la compra si el SDK no
    // está asociado exactamente a este usuario (identity_mismatch).
    const outcome = await purchasePlusPackage(selected, user.id, refreshUser);
    setBusy(false);

    switch (outcome.status) {
      case 'success':
        track({ event: 'purchase_completed', productId, pendingBackend: false });
        setPhase('success');
        break;
      case 'pending_backend':
        track({ event: 'purchase_completed', productId, pendingBackend: true });
        setPhase('pending');
        break;
      case 'cancelled':
        // Cancelar el sheet de Apple no es un error: sin modal, sin log.
        track({ event: 'purchase_cancelled', productId });
        break;
      default:
        track({ event: 'purchase_failed', productId });
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
        track({ event: 'restore_completed', found: true });
        setPhase('success');
        break;
      case 'pending_backend':
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
          {/* Hero */}
          <LinearGradient
            colors={[colors.electricBlue, '#2563eb', '#1d4ed8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <View style={s.heroIcon}>
              <Ionicons name="sparkles" size={30} color="#FFFFFF" />
            </View>
            <Text style={s.heroTitle}>{t('paywall.title')}</Text>
            <Text style={s.heroSubtitle}>{t('paywall.subtitle')}</Text>
          </LinearGradient>

          {/* Features */}
          <View style={s.features}>
            {([
              ['map-outline', t('paywall.featurePlans')],
              ['flash-outline', t('paywall.featurePriority')],
              ['diamond-outline', t('paywall.featureCurated')],
            ] as const).map(([icon, label]) => (
              <View key={icon} style={s.featureRow}>
                <Ionicons name={icon} size={20} color={colors.electricBlue} />
                <Text style={s.featureText}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Packages */}
          <View style={s.packages}>
            {packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[s.pkgCard, isSelected && s.pkgCardSelected]}
                  activeOpacity={0.8}
                  onPress={() => setSelected(pkg)}
                  testID={`paywall-pkg-${pkg.identifier}`}
                >
                  <View style={s.pkgInfo}>
                    <Text style={s.pkgLabel}>{packageLabel(pkg)}</Text>
                    {pkg.packageType === 'ANNUAL' && (
                      <View style={s.bestValueBadge}>
                        <Text style={s.bestValueText}>{t('paywall.bestValue')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.pkgPrice}>{pkg.product.priceString}</Text>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={isSelected ? colors.electricBlue : colors.borderColor}
                  />
                </TouchableOpacity>
              );
            })}
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

  // Hero
  hero: {
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 26,
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },

  // Features
  features: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  featureText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textMain,
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
  pkgInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.deepOcean,
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
  pkgPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textMain,
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
});
