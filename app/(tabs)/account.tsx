import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PlusUpsellCard } from '../../components/account/PlusUpsellCard';
import { ProfileCard } from '../../components/account/ProfileCard';
import { TravelPreferencesSection } from '../../components/account/TravelPreferencesSection';
import { SettingsSection } from '../../components/account/SettingsSection';
import { DevToolsSection } from '../../components/account/DevToolsSection';
import { LanguagePickerModal } from '../../components/account/LanguagePickerModal';

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isPro, isAdmin, logout, setTierOverride } = useAuth();
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';
  const currentLangLabel = currentLang === 'es' ? t('account.languageSpanish') : t('account.languageEnglish');

  if (!isAuthenticated || !user) {
    return (
      <View style={s.root}>
        <View style={s.guestContent}>
          <View style={s.guestIcon}>
            <Ionicons name="person-outline" size={48} color={colors.textSecondary + '80'} />
          </View>
          <Text style={s.guestTitle}>{t('account.guestTitle')}</Text>
          <Text style={s.guestBody}>{t('account.guestBody')}</Text>
          <TouchableOpacity style={s.signInBtn} activeOpacity={0.8} onPress={() => router.push('/login')}>
            <Text style={s.signInBtnText}>{t('account.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const confirmDelete = async () => {
    setDeleteVisible(false);
    const res = await api('/account', { method: 'DELETE' });
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      await logout();
    }
  };

  return (
    <View style={s.root}>
      <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollContentInner} showsVerticalScrollIndicator={false}>
        {/* Plus upsell — first card, eye-catching */}
        {!isPro && <PlusUpsellCard />}

        <ProfileCard name={user.name} email={user.email} isPro={isPro} />

        <TravelPreferencesSection disabled={!isAuthenticated} />

        <SettingsSection
          currentLangLabel={currentLangLabel}
          onOpenLanguage={() => setLangPickerVisible(true)}
          onLogout={() => setLogoutVisible(true)}
          onDelete={() => setDeleteVisible(true)}
        />

        {/* Dev Tools — solo en development + @locallist.ai admins */}
        {__DEV__ && isAdmin && (
          <DevToolsSection
            isPro={isPro}
            realTier={user?.tier ?? 'free'}
            onToggleTier={() => setTierOverride(isPro ? 'free' : 'pro')}
            onResetTier={() => setTierOverride(null)}
          />
        )}

        {/* Footer */}
        <Text style={s.version}>LocalList v1.0.0</Text>
      </ScrollView>

      <LanguagePickerModal visible={langPickerVisible} onClose={() => setLangPickerVisible(false)} />

      {/* Logout confirm */}
      <ConfirmModal
        visible={logoutVisible}
        icon="log-out-outline"
        iconColor={colors.sunsetOrange}
        title={t('account.logOut')}
        body={t('account.logOutConfirm')}
        cancelLabel={t('account.cancel')}
        confirmLabel={t('account.logOut')}
        confirmDestructive
        onCancel={() => setLogoutVisible(false)}
        onConfirm={() => { setLogoutVisible(false); logout(); }}
      />

      {/* Delete account confirm */}
      <ConfirmModal
        visible={deleteVisible}
        icon="trash-outline"
        iconColor={colors.error}
        title={t('account.deleteAccount')}
        body={t('account.deleteConfirm')}
        cancelLabel={t('account.cancel')}
        confirmLabel={t('account.delete')}
        confirmDestructive
        onCancel={() => setDeleteVisible(false)}
        onConfirm={confirmDelete}
      />

      {/* Error modal */}
      <ConfirmModal
        visible={!!errorMsg}
        icon="alert-circle-outline"
        iconColor={colors.error}
        title={t('account.error')}
        body={errorMsg ?? ''}
        confirmLabel="OK"
        onCancel={() => setErrorMsg(null)}
        onConfirm={() => setErrorMsg(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  scrollContent: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 56 },
  scrollContentInner: { paddingBottom: 40 },

  // Guest state
  guestContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  guestIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  guestTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  guestBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  signInBtn: {
    backgroundColor: colors.electricBlue,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: borderRadius.lg,
  },
  signInBtnText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },

  // Footer
  version: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary + '80',
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
