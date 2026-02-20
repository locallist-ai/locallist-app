import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeV1 } from '../../components/home/HomeV1';
import { HomeV2 } from '../../components/home/HomeV2';
import { colors, fonts } from '../../lib/theme';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const [version, setVersion] = useState<'v1' | 'v2'>('v2');
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain }}>
      {version === 'v1' ? <HomeV1 /> : <HomeV2 />}

      {/* Floating Toggle Button */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 10,
          right: 20,
          zIndex: 100,
        }}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setVersion(v => v === 'v1' ? 'v2' : 'v1');
          }}
          style={({ pressed }) => ({
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.1)',
            opacity: pressed ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          })}
        >
          <Text
            style={{
              fontFamily: fonts.bodySemiBold,
              fontSize: 13,
              color: colors.deepOcean,
            }}
          >
            {version === 'v1' ? 'Try V2 ✨' : 'Back to V1'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
