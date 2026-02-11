import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.electricBlue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.borderColor,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 85,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: { backgroundColor: colors.bgMain },
        headerTintColor: colors.deepOcean,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>{'\u{1F3E0}'}</Text>
          ),
          headerTitle: 'LocalList',
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.deepOcean,
          },
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>{'\u{1F5FA}'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>{'\u{1F464}'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
