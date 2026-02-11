import React, { useEffect, useState, useCallback } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { DevPreferencesProvider } from '../lib/dev-preferences';
import { DevPanel } from '../components/DevPanel';
import { AuthProvider } from '../lib/auth';
import { colors } from '../lib/theme';

// Keep Expo splash visible while we load
SplashScreen.preventAutoHideAsync();

function AppSplash({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Animate logo in
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
    ]).start();

    // Hold splash then fade out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={splashStyles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <Image
          source={require('../assets/images/icon.png')}
          style={splashStyles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2EFE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 125,
  },
});

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const onLayoutReady = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  if (showSplash) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutReady}>
        <StatusBar style="dark" />
        <AppSplash onFinish={() => setShowSplash(false)} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DevPreferencesProvider>
        <AuthProvider>
          <StatusBar style="dark" />
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
              name="(auth)/login"
              options={{
                title: 'Sign In',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="plan/[id]"
              options={{ title: 'Plan Details' }}
            />
            <Stack.Screen
              name="place/[id]"
              options={{ title: 'Place Details' }}
            />
            <Stack.Screen
              name="builder"
              options={{ title: 'Plan Builder' }}
            />
            <Stack.Screen
              name="follow/[id]"
              options={{
                title: 'Follow Mode',
                headerBackVisible: false,
              }}
            />
          </Stack>
          {__DEV__ && <DevPanel />}
        </AuthProvider>
      </DevPreferencesProvider>
    </SafeAreaProvider>
  );
}
