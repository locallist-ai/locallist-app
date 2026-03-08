import React from 'react';
import { View } from 'react-native';
import { HomeV2 } from '../../components/home/HomeV2';
import { colors } from '../../lib/theme';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      <HomeV2 />
    </View>
  );
}
