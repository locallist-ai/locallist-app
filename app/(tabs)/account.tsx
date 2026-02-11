import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import { colors, spacing, fonts } from '../../lib/theme';

export default function AccountScreen() {
  const { user, isAuthenticated, isPro, logout } = useAuth();
  const router = useRouter();

  // ─── Not logged in ─────────────────────────
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.loginIcon}>{'\u{1F464}'}</Text>
          <Text style={styles.loginTitle}>Your Account</Text>
          <Text style={styles.loginSubtitle}>
            Sign in to save plans, unlock Follow Mode, and access the full curated catalog.
          </Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/(auth)/login')}
          >
            <LinearGradient
              colors={[colors.electricBlue, '#2563eb']}
              style={styles.loginBtn}
            >
              <Text style={styles.loginBtnText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Logged in ─────────────────────────────
  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ PROFILE HEADER ═══════════════════ */}
      <LinearGradient
        colors={[colors.deepOcean, '#1e3a5f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileHeader}
      >
        <View style={styles.profileCornerAccent} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        {user?.name && <Text style={styles.profileName}>{user.name}</Text>}
        <Text style={styles.profileEmail}>{user?.email}</Text>
        <View style={styles.tierBadge}>
          <View style={[styles.tierDot, isPro && styles.tierDotPro]} />
          <Text style={styles.tierText}>{isPro ? 'Pro' : 'Free'}</Text>
        </View>
      </LinearGradient>

      {/* ═══ SUBSCRIPTION INFO ════════════════ */}
      {isPro ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR PLAN</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeText}>Active</Text>
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AI Plans</Text>
              <Text style={styles.infoValue}>50 / day</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Follow Mode</Text>
              <Text style={styles.infoValue}>Unlimited</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Catalog</Text>
              <Text style={styles.infoValue}>Full access</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>UPGRADE</Text>
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Unlock LocalList Pro</Text>
            <Text style={styles.upgradeSubtitle}>
              50 AI plans/day, Follow Mode, full curated catalog.
            </Text>
            <View style={styles.upgradeFeatures}>
              <FeatureRow icon="\u{1F9E0}" text="50 AI-powered plans per day" />
              <FeatureRow icon="\u{1F4CD}" text="Follow Mode — step-by-step navigation" />
              <FeatureRow icon="\u2728" text="Full curated catalog — 40+ spots" />
            </View>
            <TouchableOpacity activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.sunsetOrange, '#ea580c']}
                style={styles.upgradeBtn}
              >
                <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ═══ STATS ════════════════════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACTIVITY</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>7</Text>
            <Text style={styles.statLabel}>Plans</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>3</Text>
            <Text style={styles.statLabel}>Followed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>41</Text>
            <Text style={styles.statLabel}>Places</Text>
          </View>
        </View>
      </View>

      {/* ═══ SIGN OUT ═════════════════════════ */}
      <View style={styles.section}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLogout}
          style={styles.signOutBtn}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    paddingBottom: 40,
  },

  // ── Login Prompt ───────────────────────
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: 12,
  },
  loginIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  loginTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: colors.deepOcean,
  },
  loginSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  loginBtn: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
  },
  loginBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },

  // ── Profile Header ─────────────────────
  profileHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  profileCornerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 80,
    height: 80,
    borderBottomLeftRadius: 80,
    backgroundColor: colors.sunsetOrange + '12',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    fontFamily: fonts.headingBold,
    color: '#FFFFFF',
    fontSize: 28,
  },
  profileName: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderColor,
  },
  tierDotPro: {
    backgroundColor: colors.sunsetOrange,
  },
  tierText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ── Sections ───────────────────────────
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.sunsetOrange,
    letterSpacing: 2.5,
    marginBottom: 14,
    alignSelf: 'flex-start',
    backgroundColor: colors.sunsetOrange + '28',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // ── Info Card (Pro) ────────────────────
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.borderColor,
  },
  activeBadge: {
    backgroundColor: colors.successEmerald + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.successEmerald,
    letterSpacing: 0.3,
  },

  // ── Upgrade Card (Free) ────────────────
  upgradeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  upgradeTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
    marginBottom: 6,
  },
  upgradeSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  upgradeFeatures: {
    marginBottom: 18,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMain,
    flex: 1,
  },
  upgradeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  upgradeBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },

  // ── Stats ──────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statNum: {
    fontFamily: fonts.headingBold,
    fontSize: 22,
    color: colors.deepOcean,
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Sign Out ───────────────────────────
  signOutBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderColor,
    backgroundColor: colors.bgCard,
  },
  signOutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
