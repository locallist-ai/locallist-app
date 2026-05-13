import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useProfile } from '../../lib/use-profile';

const LANGUAGES = [
  { code: 'en', flag: '\u{1F1FA}\u{1F1F8}', labelKey: 'account.languageEnglish' as const },
  { code: 'es', flag: '\u{1F1EA}\u{1F1F8}', labelKey: 'account.languageSpanish' as const },
];

// ── Plus Upsell Card with animations ──

function PlusUpsellCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  const shimmer = useSharedValue(0);
  const sparkleScale = useSharedValue(1);

  useEffect(() => {
    // Subtle pulse
    sparkleScale.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.98, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    // Shimmer sweep
    shimmer.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, []);

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.15,
    transform: [{ translateX: -200 + shimmer.value * 500 }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(200).springify().damping(14)}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => Alert.alert(t('pro.comingSoonTitle'), t('pro.comingSoonBody'), [{ text: t('pro.ok') }])}
        style={s.plusCard}
      >
        <LinearGradient
          colors={[colors.electricBlue, '#2563eb', '#1d4ed8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.plusGradient}
        >
          {/* Shimmer overlay */}
          <Animated.View style={[s.plusShimmer, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: 120, height: '100%' }}
            />
          </Animated.View>

          {/* Content */}
          <View style={s.plusRow}>
            <View style={s.plusIconBig}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
            <View style={s.plusInfo}>
              <Text style={s.plusTitle}>{t('account.plusTitle')}</Text>
              <Text style={s.plusSubtitle}>{t('account.plusSubtitle')}</Text>
            </View>
          </View>

          {/* CTA */}
          <Animated.View style={[s.plusCtaBtn, sparkleStyle]}>
            <Text style={s.plusCtaText}>{t('account.plusCta')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Animated.View>

          {/* Decorative circles */}
          <View style={s.plusDeco1} />
          <View style={s.plusDeco2} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isPro, isAdmin, logout, setTierOverride } = useAuth();
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prefSaved, setPrefSaved] = useState(false);
  const { profile, saving: prefSaving, save: saveProfile, remove: removeProfile } = useProfile(!isAuthenticated);

  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';
  const currentLangLabel = currentLang === 'es' ? t('account.languageSpanish') : t('account.languageEnglish');
  const selectedLang = pendingLang ?? currentLang;

  if (!isAuthenticated || !user) {
    return (
      <View style={s.root}>
        <View style={s.guestContent}>
          <View style={s.guestIcon}>
            <Ionicons name="person-outline" size={48} color={colors.textSecondary + '80'} />
          </View>
          <Text style={s.guestTitle}>{t('account.guestTitle')}</Text>
          <Text style={s.guestBody}>
            {t('account.guestBody')}
          </Text>
          <TouchableOpacity
            style={s.signInBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/login')}
          >
            <Text style={s.signInBtnText}>{t('account.signIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initial = (user.name ?? user.email)?.[0]?.toUpperCase() ?? '?';

  const handleLogout = () => setLogoutVisible(true);

  const handleDeleteAccount = () => setDeleteVisible(true);

  const confirmDelete = async () => {
    setDeleteVisible(false);
    const res = await api('/account', { method: 'DELETE' });
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      await logout();
    }
  };

  const handleOpenLangPicker = () => {
    setPendingLang(null);
    setLangPickerVisible(true);
  };

  const handleApplyLanguage = () => {
    if (pendingLang && pendingLang !== currentLang) {
      i18n.changeLanguage(pendingLang);
    }
    setLangPickerVisible(false);
    setPendingLang(null);
  };

  const handleCloseLangPicker = () => {
    setLangPickerVisible(false);
    setPendingLang(null);
  };

  const GROUP_TYPES = [
    { value: 'solo', label: t('wizard.companySolo') },
    { value: 'couple', label: t('wizard.companyCouple') },
    { value: 'family', label: t('wizard.companyFamily') },
    { value: 'friends', label: t('wizard.companyFriends') },
  ] as const;
  const PACES = [
    { value: 'slow', label: t('profile.paceSlow') },
    { value: 'normal', label: t('profile.paceNormal') },
    { value: 'fast', label: t('profile.paceFast') },
  ] as const;
  const BUDGETS = [
    { value: 'budget', label: t('profile.budgetBudget') },
    { value: 'moderate', label: t('profile.budgetModerate') },
    { value: 'premium', label: t('profile.budgetPremium') },
  ] as const;

  const handleSavePrefs = async (fields: {
    defaultGroupType?: string | null;
    pacePreference?: string | null;
    defaultBudgetTier?: string | null;
  }) => {
    const ok = await saveProfile(fields);
    if (ok) {
      setPrefSaved(true);
      setTimeout(() => setPrefSaved(false), 2500);
    }
  };

  const handleResetPrefs = async () => {
    Alert.alert(t('profile.reset'), t('profile.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeProfile() },
    ]);
  };

  return (
    <View style={s.root}>
      <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollContentInner} showsVerticalScrollIndicator={false}>
        {/* Plus upsell — first card, eye-catching */}
        {!isPro && <PlusUpsellCard t={t} />}

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={s.profileInfo}>
            {user.name && <Text style={s.profileName}>{user.name}</Text>}
            <Text style={s.profileEmail}>{user.email}</Text>
          </View>
          <View style={[s.tierBadge, isPro && s.tierBadgePro]}>
            <Text style={[s.tierText, isPro && s.tierTextPro]}>
              {isPro ? t('account.pro') : t('account.free')}
            </Text>
          </View>
        </View>

        {/* Travel Preferences */}
        <View style={s.prefHeader}>
          <Text style={s.prefHeaderTitle}>{t('profile.title')}</Text>
          <Text style={s.prefHeaderSub}>{t('profile.subtitle')}</Text>
        </View>
        <View style={s.section}>
          {/* Group type */}
          <View style={s.prefRow}>
            <Text style={s.prefLabel}>{t('profile.groupType')}</Text>
            <View style={s.chipRow}>
              {GROUP_TYPES.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[s.prefChip, profile?.defaultGroupType === value && s.prefChipOn]}
                  onPress={() => handleSavePrefs({ defaultGroupType: profile?.defaultGroupType === value ? null : value })}
                >
                  <Text style={[s.prefChipText, profile?.defaultGroupType === value && s.prefChipTextOn]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Pace */}
          <View style={s.prefRow}>
            <Text style={s.prefLabel}>{t('profile.pace')}</Text>
            <View style={s.chipRow}>
              {PACES.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[s.prefChip, profile?.pacePreference === value && s.prefChipOn]}
                  onPress={() => handleSavePrefs({ pacePreference: profile?.pacePreference === value ? null : value })}
                >
                  <Text style={[s.prefChipText, profile?.pacePreference === value && s.prefChipTextOn]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Budget */}
          <View style={[s.prefRow, s.prefRowLast]}>
            <Text style={s.prefLabel}>{t('profile.budget')}</Text>
            <View style={s.chipRow}>
              {BUDGETS.map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[s.prefChip, profile?.defaultBudgetTier === value && s.prefChipOn]}
                  onPress={() => handleSavePrefs({ defaultBudgetTier: profile?.defaultBudgetTier === value ? null : value })}
                >
                  <Text style={[s.prefChipText, profile?.defaultBudgetTier === value && s.prefChipTextOn]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Saved feedback + reset */}
        <View style={s.prefActions}>
          {prefSaved && <Text style={s.prefSaved}>{t('profile.saved')}</Text>}
          {prefSaving && <Text style={s.prefSaving}>Saving…</Text>}
          {profile && (
            <TouchableOpacity onPress={handleResetPrefs} style={s.prefReset}>
              <Text style={s.prefResetText}>{t('profile.reset')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.row}
            activeOpacity={0.7}
            onPress={() => Share.share({ message: t('account.shareMessage') })}
          >
            <Ionicons name="share-social-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>{t('account.shareLocalList')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleOpenLangPicker}>
            <Ionicons name="language-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>{t('account.language')}</Text>
            <Text style={s.rowValue}>{currentLangLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.row}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://locallist.ai/privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>{t('account.privacyPolicy')}</Text>
            <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.row}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://locallist.ai/terms')}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>{t('account.termsOfService')}</Text>
            <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={s.section}>
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>{t('account.logOut')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
            <Text style={[s.rowText, { color: colors.error }]}>{t('account.deleteAccount')}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dev Tools — solo en development + @locallist.ai admins */}
        {__DEV__ && isAdmin && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)}>
            <View style={s.devHeader}>
              <Ionicons name="construct-outline" size={14} color={colors.sunsetOrange} />
              <Text style={s.devHeaderText}>Dev Tools</Text>
            </View>
            <View style={s.section}>
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => setTierOverride(isPro ? 'free' : 'pro')}
              >
                <Ionicons
                  name={isPro ? 'sparkles' : 'sparkles-outline'}
                  size={22}
                  color={isPro ? colors.sunsetOrange : colors.textMain}
                />
                <Text style={s.rowText}>
                  {isPro ? 'Switch to Free' : 'Switch to Pro'}
                </Text>
                <View style={[s.tierBadge, isPro && s.tierBadgePro]}>
                  <Text style={[s.tierText, isPro && s.tierTextPro]}>
                    {isPro ? 'PRO' : 'FREE'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => setTierOverride(null)}
              >
                <Ionicons name="refresh-outline" size={22} color={colors.textMain} />
                <Text style={s.rowText}>Reset to real tier</Text>
                <Text style={s.rowValue}>{user?.tier ?? 'free'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Footer */}
        <Text style={s.version}>LocalList v1.0.0</Text>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={langPickerVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseLangPicker}
      >
        <Pressable style={s.modalOverlay} onPress={handleCloseLangPicker}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFill}
          >
            <View style={s.modalBackdrop} />
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(250).springify()}
            exiting={FadeOut.duration(150)}
            style={s.modalContent}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={s.pickerContainer}>
                {/* Handle bar */}
                <View style={s.handleBar} />

                {/* Title */}
                <Text style={s.pickerTitle}>{t('account.language')}</Text>

                {/* Language options */}
                {LANGUAGES.map((lang, index) => {
                  const isSelected = selectedLang === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      activeOpacity={0.8}
                      onPress={() => setPendingLang(lang.code)}
                      style={[
                        s.langOption,
                        isSelected && s.langOptionSelected,
                        index < LANGUAGES.length - 1 && s.langOptionBorder,
                      ]}
                    >
                      <Text style={s.langFlag}>{lang.flag}</Text>
                      <Text style={[s.langLabel, isSelected && s.langLabelSelected]}>
                        {t(lang.labelKey)}
                      </Text>
                      {isSelected && (
                        <Animated.View entering={ZoomIn.duration(300).springify()}>
                          <View style={s.langCheck}>
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          </View>
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Buttons */}
                <View style={s.pickerButtons}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCloseLangPicker}
                    style={s.closeBtn}
                  >
                    <Text style={s.closeBtnText}>{t('account.close')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleApplyLanguage}
                    style={[
                      s.applyBtn,
                      (!pendingLang || pendingLang === currentLang) && s.applyBtnDisabled,
                    ]}
                    disabled={!pendingLang || pendingLang === currentLang}
                  >
                    <Text style={s.applyBtnText}>{t('account.apply')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

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

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.electricBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.electricBlue,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
  profileEmail: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tierBadge: {
    backgroundColor: colors.textSecondary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  tierBadgePro: { backgroundColor: colors.sunsetOrange + '15' },
  tierText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.textSecondary },
  tierTextPro: { color: colors.sunsetOrange },

  // Plus upsell
  plusCard: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  plusGradient: {
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  plusShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  plusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  plusIconBig: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusInfo: { flex: 1 },
  plusTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  plusSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  plusCtaBtn: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plusCtaText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  plusDeco1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  plusDeco2: {
    position: 'absolute',
    bottom: -10,
    right: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },

  // Rows
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 4,
  },

  // Dev Tools
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  devHeaderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.sunsetOrange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Footer
  version: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary + '80',
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },

  // Language picker modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 340,
  },
  pickerContainer: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.bgMain,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: 20,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 14,
  },
  langOptionSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    marginHorizontal: -8,
  },
  langOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  langFlag: {
    fontSize: 28,
  },
  langLabel: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
  langLabelSelected: {
    color: colors.sunsetOrange,
  },
  langCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  closeBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: colors.sunsetOrange,
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Travel preferences
  prefHeader: {
    marginBottom: 10,
  },
  prefHeaderTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  prefHeaderSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefRow: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  prefRowLast: {
    borderBottomWidth: 0,
  },
  prefLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefChip: {
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.bgMain,
  },
  prefChipOn: {
    borderColor: colors.electricBlue,
    backgroundColor: colors.electricBlueLight,
  },
  prefChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefChipTextOn: {
    color: colors.electricBlue,
  },
  prefActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -8,
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  prefSaved: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.successEmerald,
  },
  prefSaving: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  prefReset: {
    paddingVertical: 4,
  },
  prefResetText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
