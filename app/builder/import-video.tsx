import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing } from '../../lib/theme';

export default function ImportVideoScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgMain, paddingTop: insets.top }}>
      <TouchableOpacity
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.bgCard,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: spacing.lg,
          marginTop: spacing.md,
        }}
        onPress={() => router.back()}
      >
        <Ionicons name="close" size={24} color={colors.textMain} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, marginTop: -60 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.electricBlueLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <Ionicons name="videocam-outline" size={48} color={colors.electricBlue} />
        </View>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, color: colors.deepOcean, marginBottom: spacing.sm, textAlign: 'center' }}>
          {t('plans.importVideo')}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 }}>
          {"Paste a Reels or TikTok link and we'll turn it into a plan."}
        </Text>
      </View>
    </View>
  );
}
