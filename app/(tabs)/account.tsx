import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';

export default function AccountScreen() {
  const { user, isAuthenticated, isPro, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <View style={s.root}>
        <View style={s.guestContent}>
          <View style={s.guestIcon}>
            <Ionicons name="person-outline" size={48} color={colors.textSecondary + '80'} />
          </View>
          <Text style={s.guestTitle}>Sign in to save your plans</Text>
          <Text style={s.guestBody}>
            Create an account to save plans, use Follow Mode, and unlock Pro features.
          </Text>
          <TouchableOpacity
            style={s.signInBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/login')}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initial = (user.name ?? user.email)?.[0]?.toUpperCase() ?? '?';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await api('/account', { method: 'DELETE' });
            if (res.error) {
              Alert.alert('Error', res.error);
            } else {
              await logout();
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={s.header}>Account</Text>

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
              {isPro ? 'Pro' : 'Free'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.section}>
          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.textMain} />
            <Text style={s.rowText}>Log Out</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
            <Text style={[s.rowText, { color: colors.error }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={s.version}>LocalList v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMain },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    fontFamily: fonts.headingBold,
    fontSize: 28,
    color: colors.deepOcean,
    paddingTop: 56,
    paddingBottom: spacing.lg,
  },

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

  // Footer
  version: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary + '80',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
