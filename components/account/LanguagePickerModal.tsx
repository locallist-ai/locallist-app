import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../../lib/theme';

const LANGUAGES = [
  { code: 'en', flag: '\u{1F1FA}\u{1F1F8}', labelKey: 'account.languageEnglish' as const },
  { code: 'es', flag: '\u{1F1EA}\u{1F1F8}', labelKey: 'account.languageSpanish' as const },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LanguagePickerModal({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [pendingLang, setPendingLang] = useState<string | null>(null);

  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en';
  const selectedLang = pendingLang ?? currentLang;

  // Reset the pending selection each time the picker opens.
  useEffect(() => {
    if (visible) setPendingLang(null);
  }, [visible]);

  const handleApply = () => {
    if (pendingLang && pendingLang !== currentLang) {
      i18n.changeLanguage(pendingLang);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
        >
          <View style={s.modalBackdrop} />
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(250).springify()}
          exiting={FadeOut.duration(150)}
          style={s.modalContent}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={s.pickerContainer}>
              {/* Handle bar */}
              <View style={s.handleBar} />

              {/* Title */}
              <Text style={s.pickerTitle}>{t('account.language')}</Text>

              {/* Language options */}
              {LANGUAGES.map((lang, index) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    activeOpacity={0.8}
                    onPress={() => setPendingLang(lang.code)}
                    style={[
                      s.langOption,
                      isSelected && s.langOptionSelected,
                      index < LANGUAGES.length - 1 && s.langOptionBorder,
                    ]}
                  >
                    <Text style={s.langFlag}>{lang.flag}</Text>
                    <Text style={[s.langLabel, isSelected && s.langLabelSelected]}>
                      {t(lang.labelKey)}
                    </Text>
                    {isSelected && (
                      <Animated.View entering={ZoomIn.duration(300).springify()}>
                        <View style={s.langCheck}>
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        </View>
                      </Animated.View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Buttons */}
              <View style={s.pickerButtons}>
                <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={s.closeBtn}>
                  <Text style={s.closeBtnText}>{t('account.close')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleApply}
                  style={[
                    s.applyBtn,
                    (!pendingLang || pendingLang === currentLang) && s.applyBtnDisabled,
                  ]}
                  disabled={!pendingLang || pendingLang === currentLang}
                >
                  <Text style={s.applyBtnText}>{t('account.apply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 340,
  },
  pickerContainer: {
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.bgMain,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.deepOcean,
    textAlign: 'center',
    marginBottom: 20,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 14,
  },
  langOptionSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 12,
    marginHorizontal: -8,
  },
  langOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  langFlag: {
    fontSize: 28,
  },
  langLabel: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.deepOcean,
  },
  langLabelSelected: {
    color: colors.sunsetOrange,
  },
  langCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sunsetOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  closeBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: colors.sunsetOrange,
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
