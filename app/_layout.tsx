import '../lib/i18n';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated as RNAnimated, Platform, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { colors } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/auth';
import { preloadPlans } from '../lib/preload';
import { logger } from '../lib/logger';
import LoginScreen from './login';

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

export default function RootLayout() {
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
  );
}

// Shows login if not authenticated, app stack if authenticated
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  // Still checking stored tokens
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgMain, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppStack />;
}

function AppStack() {
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
      <Stack.Screen name="builder" options={{ headerShown: false }} />
      <Stack.Screen
        name="plan/[id]"
        options={{
          title: 'Plan',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="follow/[id]"
        options={{
          title: 'Follow Mode',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
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
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.emoji}>😵</Text>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <TouchableOpacity style={errorStyles.button} onPress={retry}>
        <Text style={errorStyles.buttonText}>Try Again</Text>
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
