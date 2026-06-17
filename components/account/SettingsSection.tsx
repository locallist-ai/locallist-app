import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, fonts, spacing, borderRadius } from '../../lib/theme';

type Props = {
  currentLangLabel: string;
  onOpenLanguage: () => void;
  onLogout: () => void;
  onDelete: () => void;
};

export function SettingsSection({ currentLangLabel, onOpenLanguage, onLogout, onDelete }: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* Settings */}
      <View style={s.section}>
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => Share.share({ message: t('account.shareMessage') })}
        >
          <Ionicons name="share-social-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('account.shareLocalList')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onOpenLanguage}>
          <Ionicons name="language-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('account.language')}</Text>
          <Text style={s.rowValue}>{currentLangLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Legal — links stay in-app via expo-web-browser */}
      <View style={s.section}>
        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => WebBrowser.openBrowserAsync('https://locallist.ai/privacy')}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('account.privacyPolicy')}</Text>
          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.row}
          activeOpacity={0.7}
          onPress={() => WebBrowser.openBrowserAsync('https://locallist.ai/terms')}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('account.termsOfService')}</Text>
          <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={s.section}>
        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.textMain} />
          <Text style={s.rowText}>{t('account.logOut')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={onDelete}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
          <Text style={[s.rowText, { color: colors.error }]}>{t('account.deleteAccount')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    gap: 12,
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMain,
  },
  rowValue: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 4,
  },
});
