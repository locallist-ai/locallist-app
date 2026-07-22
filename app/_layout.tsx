import '../lib/i18n';
import i18n from '../lib/i18n';
import { initSentry, Sentry } from '../lib/sentry';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated, Platform, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { colors } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/auth';
import { usePurchaseReconciliation } from '../lib/usePurchaseReconciliation';
import { useTrialReminder } from '../lib/trial-reminder/useTrialReminder';
import { preloadPlans } from '../lib/preload';
import { logger } from '../lib/logger';
import LoginScreen from './login';

// Initialize Sentry as early as possible
initSentry();

SplashScreen.preventAutoHideAsync();

// ─── Animated Splash ─────────────────────────────────────
// Shows logo + tagline, waits for auth to load, then fades out.

function AppSplash({ onFinish }: { onFinish: () => void }) {
  const { isLoading: authLoading } = useAuth();
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.85)).current;
  const [animatedIn, setAnimatedIn] = useState(false);

  // Step 1: Fade in logo + preload data in parallel
  useEffect(() => {
    // Start preloading plans data & images while splash animates
    preloadPlans();

    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      RNAnimated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => setAnimatedIn(true));
  }, []);

  // Step 2: When auth is done AND animation finished, fade out
  useEffect(() => {
    if (!animatedIn || authLoading) return;

    // Minimum visible time so the splash feels intentional
    const timer = setTimeout(() => {
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1200);

    return () => clearTimeout(timer);
  }, [animatedIn, authLoading]);

  return (
    <View style={splashStyles.container}>
      <RNAnimated.View
        style={[
          splashStyles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <RNAnimated.Image
          source={require('../assets/images/icon-text.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.tagline}>Stop Researching. Start Traveling.</Text>
      </RNAnimated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 80,
  },
  tagline: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'InterSemiBold',
    color: '#94a3b8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// ─── Root Layout ─────────────────────────────────────────
// Flow: Splash → Login (if not authenticated) → App

function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    Inter: require('../assets/fonts/Inter-Regular.ttf'),
    InterMedium: require('../assets/fonts/Inter-Medium.ttf'),
    InterSemiBold: require('../assets/fonts/Inter-SemiBold.ttf'),
    InterBold: require('../assets/fonts/Inter-Bold.ttf'),
    PlayfairDisplay: require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
    PlayfairDisplaySemiBold: require('../assets/fonts/PlayfairDisplay-SemiBold.ttf'),
    PlayfairDisplayBold: require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
  });

  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          {showSplash ? (
            <View style={{ flex: 1 }} onLayout={onLayoutReady}>
              <AppSplash onFinish={() => setShowSplash(false)} />
            </View>
          ) : (
            <AuthGate />
          )}
        </SafeAreaProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

// Wrap root component with Sentry for automatic performance & error tracking
export default Sentry.wrap(RootLayout);

// Shows login if not authenticated, app stack if authenticated
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  // Still checking stored tokens
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgMain, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppStack />;
}

function AppStack() {
  const { t } = useTranslation();
  // Reconcilia el tier en caliente tras una compra IAP (webhook retrasado /
  // vuelta a foreground) sin depender de que el usuario siga en el paywall.
  usePurchaseReconciliation();
  // Recordatorio de fin de trial (día 5): presentación en foreground, tap →
  // evento + cuenta, y cancelación del recordatorio huérfano vía tier.
  useTrialReminder();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgMain },
        headerTintColor: colors.deepOcean,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bgMain },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="builder" options={{ headerShown: false }} />
      <Stack.Screen
        name="plan/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="follow/[id]"
        options={{
          title: t('nav.followMode'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="place/[id]"
        options={{
          title: t('nav.place'),
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: t('nav.signIn'),
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
      <Stack.Screen
        name="paywall"
        options={{
          headerShown: false,
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
    </Stack>
  );
}

// ─── Global Error Boundary ──────────────────────────────
// Catches unhandled JS exceptions and shows a recovery UI instead of a white screen.

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    logger.error('Unhandled error caught by ErrorBoundary', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.emoji}>😵</Text>
      <Text style={errorStyles.title}>{i18n.t('common.somethingWentWrong')}</Text>
      <Text style={errorStyles.message}>{i18n.t('common.unexpectedError')}</Text>
      <TouchableOpacity style={errorStyles.button} onPress={retry} accessibilityRole="button" accessibilityLabel={i18n.t('common.tryAgain')}>
        <Text style={errorStyles.buttonText}>{i18n.t('common.tryAgain')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 20,
    fontFamily: 'InterBold',
    color: colors.deepOcean,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.electricBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'InterSemiBold',
    fontSize: 16,
  },
});
