import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle, PrimaryButton } from '../ui/design-system';
import { MAX_HANDLE } from '../../lib/import/import-errors';
import type { ImportPlatform } from '../../lib/analytics';

// Idle state of the import screen (self-first).
// Happy path is a single tap: "Choose a video or photo" (platform stays `self`).
// The third-party ATTRIBUTION UI (platform selector + disclaimer + optional
// handle) is preserved in full but FOLDED behind a discreet link, so the default
// flow has no dead-end while `Import:ThirdPartyEnabled` is off, and users who do
// have a right to attribute can still expand it.

const PLATFORM_OPTIONS: { value: ImportPlatform; labelKey: string }[] = [
  { value: 'self', labelKey: 'import.platformSelf' },
  { value: 'tiktok', labelKey: 'import.platformTiktok' },
  { value: 'instagram', labelKey: 'import.platformInstagram' },
  { value: 'other', labelKey: 'import.platformOther' },
];

export interface ImportIdleProps {
  platform: ImportPlatform;
  onPlatformChange: (p: ImportPlatform) => void;
  creatorHandle: string;
  onHandleChange: (h: string) => void;
  errorKey: string | null;
  retryable: boolean;
  onChoose: () => void;
  onRetry: () => void;
  paddingTop?: number;
}

export const ImportIdle: React.FC<ImportIdleProps> = ({
  platform,
  onPlatformChange,
  creatorHandle,
  onHandleChange,
  errorKey,
  retryable,
  onChoose,
  onRetry,
  paddingTop = 0,
}) => {
  const { t } = useTranslation();
  const td = t as unknown as (key: string) => string;
  // Attribution starts collapsed: the third-party path is opt-in, the happy path
  // is one tap. Expanding never blocks the primary CTA below.
  const [attributionOpen, setAttributionOpen] = useState(false);
  const isThirdParty = platform !== 'self';

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingTop: paddingTop + spacing.md }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Neutral media icon (accepts a video OR a photo — not a movie camera). */}
      <View style={s.iconBubble}>
        <MaterialCommunityIcons name="image-multiple-outline" size={40} color={colors.sunsetOrange} />
      </View>
      <EditorialTitle text={t('import.title')} size="sm" style={s.title} />
      <StepSubtitle text={t('import.intro')} style={s.intro} />

      {errorKey ? (
        <View style={s.errorBox}>
          <Text style={s.errorBannerText}>{td(errorKey)}</Text>
          {retryable ? (
            <TouchableOpacity onPress={onRetry} accessibilityRole="button" testID="import-retry">
              <Text style={s.retryText}>{t('import.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <PrimaryButton
        label={t('import.chooseVideo')}
        onPress={onChoose}
        icon="tray-arrow-up"
        testID="import-choose"
        style={s.cta}
      />
      <Text style={s.hint}>{t('import.chooseVideoHint')}</Text>

      {/* Discreet opt-in to the third-party attribution UI. */}
      <TouchableOpacity
        testID="import-attribution-toggle"
        onPress={() => setAttributionOpen((v) => !v)}
        style={s.attributionToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: attributionOpen }}
        accessibilityLabel={t('import.addAttribution')}
      >
        <Text style={s.attributionToggleText}>{t('import.addAttribution')}</Text>
        <MaterialCommunityIcons
          name={attributionOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.sunsetOrange}
        />
      </TouchableOpacity>

      {attributionOpen ? (
        <View style={s.attributionPanel} testID="import-attribution-panel">
          <Text style={s.platformLabel}>{t('import.platformLabel')}</Text>
          <View style={s.platformRow}>
            {PLATFORM_OPTIONS.map((opt) => {
              const on = platform === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  testID={`import-platform-${opt.value}`}
                  onPress={() => onPlatformChange(opt.value)}
                  style={[s.pill, on && s.pillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(opt.labelKey as 'import.platformSelf')}
                >
                  <Text style={[s.pillText, on && s.pillTextOn]}>
                    {t(opt.labelKey as 'import.platformSelf')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isThirdParty ? (
            <>
              {/* Prominent, unambiguous legal notice — only for third-party clips. */}
              <View style={s.disclaimerBox} testID="import-disclaimer">
                <MaterialCommunityIcons
                  name="alert-outline"
                  size={20}
                  color={colors.sunsetOrange}
                  style={s.disclaimerIcon}
                />
                <Text style={s.disclaimerText}>{t('import.disclaimer')}</Text>
              </View>

              {/* Optional creator attribution (not logged — treated as PII). */}
              <Text style={s.platformLabel}>{t('import.creatorHandleLabel')}</Text>
              <TextInput
                testID="import-creator-handle"
                style={s.handleInput}
                value={creatorHandle}
                onChangeText={onHandleChange}
                placeholder={t('import.creatorHandlePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                maxLength={MAX_HANDLE}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  iconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.sunsetOrangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignSelf: 'center',
  },
  title: {
    marginBottom: spacing.sm,
  },
  intro: {
    marginBottom: spacing.xl,
  },
  cta: {
    alignSelf: 'stretch',
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  attributionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  attributionToggleText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.sunsetOrange,
  },
  attributionPanel: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  platformLabel: {
    alignSelf: 'stretch',
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMain,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  // Shared wizard pill token (same look as the day pills), text-sized.
  pill: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  pillOn: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  pillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMain,
  },
  pillTextOn: {
    color: '#FFFFFF',
  },
  disclaimerBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.sunsetOrangeLight,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  disclaimerIcon: {
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMain,
  },
  handleInput: {
    alignSelf: 'stretch',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.borderColor,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMain,
  },
  errorBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorBannerText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.sunsetOrange,
    textDecorationLine: 'underline',
  },
});
