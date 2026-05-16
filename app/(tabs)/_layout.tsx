import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';
import { useResponsive } from '../../lib/responsive';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { compact } = useResponsive();

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderColor,
          paddingTop: compact ? 3 : 6,
        },
        tabBarActiveTintColor: colors.sunsetOrange,
        // Pablo 2026-04-27: tabs en mismo color paleta wizard. Inactive ahora
        // es sunsetOrange muted (40% alpha) en vez de gris textSecondary.
        tabBarInactiveTintColor: colors.sunsetOrange + '66',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: fonts.bodySemiBold,
          fontSize: compact ? 9 : 10,
          letterSpacing: compact ? 0.3 : 0.6,
          textTransform: 'uppercase',
          marginTop: compact ? 1 : 2,
        },
        tabBarIconStyle: {
          marginTop: compact ? 1 : 2,
        },
        headerStyle: { backgroundColor: colors.bgMain },
        headerTintColor: colors.deepOcean,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: t('tabs.plans'),
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
