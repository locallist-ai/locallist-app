import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../lib/auth';
import { colors, spacing, typography } from '../../lib/theme';

export default function AccountScreen() {
  const { user, isAuthenticated, isPro, logout } = useAuth();
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.loginPrompt}>
          <Text style={styles.title}>Your Account</Text>
          <Text style={styles.subtitle}>
            Sign in to access your plans and manage your subscription.
          </Text>
          <Button
            title="Sign In"
            onPress={() => router.push('/(auth)/login')}
            variant="primary"
            size="lg"
          />
        </View>
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              {user?.name && <Text style={styles.name}>{user.name}</Text>}
              <Text style={styles.email}>{user?.email}</Text>
              <Badge
                text={isPro ? 'Pro' : 'Free'}
                variant={isPro ? 'orange' : 'default'}
              />
            </View>
          </View>
        </Card>

        {!isPro && (
          <Card style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
            <Text style={styles.upgradeDescription}>
              Unlock AI Builder, Follow Mode, and the full curated catalog.
            </Text>
            <Button
              title="View Plans"
              onPress={() => {
                // TODO: trigger paywall
              }}
              variant="secondary"
              size="md"
            />
          </Card>
        )}

        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
  },
  content: {
    padding: spacing.lg,
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...typography.h3,
  },
  email: {
    ...typography.bodySmall,
  },
  upgradeCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.sunsetOrangeLight,
    gap: spacing.sm,
  },
  upgradeTitle: {
    ...typography.h3,
  },
  upgradeDescription: {
    ...typography.bodySmall,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
});
