import React, { useEffect } from 'react';
import { View } from 'react-native';
import { colors } from '../../lib/theme';
import { track } from '../../lib/analytics';
import { HomeScreen } from '../../components/home/HomeScreen';

export default function WizardScreen() {
  useEffect(() => {
    track({ event: 'wizard_started' });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      <HomeScreen />
    </View>
  );
}
