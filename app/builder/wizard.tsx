import React from 'react';
import { View } from 'react-native';
import { colors } from '../../lib/theme';
import { HomeScreen } from '../../components/home/HomeScreen';

export default function WizardScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      <HomeScreen />
    </View>
  );
}
