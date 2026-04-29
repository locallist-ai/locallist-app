import React from 'react';
import { View } from 'react-native';
import { HomeScreen } from '../../components/home/HomeScreen';
import { colors } from '../../lib/theme';

export default function HomeTab() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      <HomeScreen />
    </View>
  );
}
