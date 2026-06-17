import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';

type Props = {
  insets: EdgeInsets;
  isAuthenticated: boolean;
  myPlansCount: number;
  onExploreCurated: () => void;
  onBuildOwn: () => void;
  onImportVideo: () => void;
  onMyPlans: () => void;
};

export function ChooserMode({
  insets,
  isAuthenticated,
  myPlansCount,
  onExploreCurated,
  onBuildOwn,
  onImportVideo,
  onMyPlans,
}: Props) {
  const { t } = useTranslation();

  const chooserCards: Array<{
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    sub: string;
    onPress: () => void;
    badge?: string;
  }> = [
    {
      icon: 'compass-outline',
      title: t('plans.exploreCurated'),
      sub: t('plans.exploreCuratedSub'),
      onPress: onExploreCurated,
    },
    {
      icon: 'creation',
      title: t('plans.buildYourOwn'),
      sub: t('plans.buildYourOwnSub'),
      onPress: onBuildOwn,
    },
    {
      icon: 'movie-open-outline',
      title: t('plans.importVideo'),
      sub: t('plans.importVideoSub'),
      onPress: onImportVideo,
    },
    ...(isAuthenticated
      ? [
          {
            icon: 'pin-outline' as keyof typeof MaterialCommunityIcons.glyphMap,
            title: t('plans.myPlans'),
            sub:
              myPlansCount > 0
                ? t('plans.myPlansCount', { count: myPlansCount, s: myPlansCount === 1 ? '' : 's' })
                : t('plans.myPlansEmpty'),
            onPress: onMyPlans,
          },
        ]
      : []),
  ];

  return (
    <ScrollView
      contentContainerStyle={[s.chooserContainer, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.chooserHeader}>
        <EditorialTitle text={t('plans.chooserTitle')} size="md" align="left" color="#FFFFFF" withShadow />
        <StepSubtitle
          text={t('plans.chooserSubtitle')}
          size="md"
          align="left"
          color="rgba(255,255,255,0.75)"
          withShadow
          style={{ marginTop: 8 }}
        />
      </View>

      {chooserCards.map((card, idx) => (
        <Animated.View key={card.title} entering={FadeInDown.delay(idx * 70).duration(380)}>
          <TouchableOpacity activeOpacity={0.85} onPress={card.onPress}>
            <BlurView intensity={50} tint="light" style={s.chooserCard}>
              <View style={s.chooserIconBubble}>
                <MaterialCommunityIcons name={card.icon} size={26} color={colors.sunsetOrange} />
              </View>
              <View style={s.chooserTextWrap}>
                <View style={s.chooserTitleRow}>
                  <Text style={s.chooserTitle}>{card.title}</Text>
                  {card.badge && (
                    <View style={s.plusBadge}>
                      <Text style={s.plusBadgeText}>{card.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.chooserSub}>{card.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
            </BlurView>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  chooserContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  chooserHeader: {
    marginBottom: spacing.lg,
  },
  chooserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.sm,
  },
  chooserIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  chooserTextWrap: {
    flex: 1,
  },
  chooserTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  chooserTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusBadge: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  plusBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  chooserSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
});
