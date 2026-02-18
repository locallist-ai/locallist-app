import '../lib/i18n';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/auth';
import LoginScreen from './login';

SplashScreen.preventAutoHideAsync();

// ─── Animated Splash ─────────────────────────────────────
// Shows logo + tagline, waits for auth to load, then fades out.

function AppSplash({ onFinish }: { onFinish: () => void }) {
  const { isLoading: authLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const [animatedIn, setAnimatedIn] = useState(false);

  // Step 1: Fade in logo
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
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
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1200);

    return () => clearTimeout(timer);
  }, [animatedIn, authLoading]);

  return (
    <View style={splashStyles.container}>
      <Animated.View
        style={[
          splashStyles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Animated.Image
          source={require('../assets/images/icon-text.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
        <Text style={splashStyles.tagline}>Only The Best. Nothing Else.</Text>
      </Animated.View>
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
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: '#94a3b8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// ─── Root Layout ─────────────────────────────────────────
// Flow: Splash → Login (if not authenticated) → App

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

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
    // Mandatory login — not a modal, it's the full screen
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
      <Stack.Screen
        name="auth/verify"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
