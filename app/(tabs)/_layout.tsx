import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from '../../lib/ThemeContext';

export default function TabsLayout() {
  const { colors: c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerStyle: { backgroundColor: c.bgMain },
        headerTintColor: c.deepOcean,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ headerShown: false }}
      />
    </Tabs>
  );
}
