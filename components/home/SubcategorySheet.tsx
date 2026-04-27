import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts, colors, borderRadius } from '../../lib/theme';
import type { SubcategoryOption } from './constants';

// Drill-down sheet para sub-opciones de un interest top-level (ej. food →
// sushi/italian/...). Multi-select. "Cualquiera" cierra sin selecciones.
// "Listo" confirma. Estética del wizard: BlurView sobre fondo oscuro, Playfair,
// sunsetOrange en chips selected.

interface SubcategorySheetProps {
  visible: boolean;
  /** Label del interest top-level (ej. "Food") — usado en el title. */
  parentLabel: string;
  /** Opciones disponibles para este interest. */
  options: SubcategoryOption[];
  /** Selecciones actuales (para reabrir y editar). */
  initialSelected: string[];
  onConfirm: (selected: string[]) => void;
  onCancel: () => void;
}

export const SubcategorySheet: React.FC<SubcategorySheetProps> = ({
  visible,
  parentLabel,
  options,
  initialSelected,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>(initialSelected);

  // Reset interno cuando el sheet abre con un parent distinto.
  useEffect(() => {
    if (visible) setSelected(initialSelected);
  }, [visible, initialSelected]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAny = () => onConfirm([]);
  const handleDone = () => onConfirm(selected);

  const title = useMemo(
    () => t('wizard.interestSubcategoryTitle', { category: parentLabel.toLowerCase() }),
    [t, parentLabel],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel} accessibilityElementsHidden>
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
          <View style={styles.backdrop} />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(180).easing(Easing.in(Easing.cubic))}
          style={[styles.sheetWrap, { paddingBottom: insets.bottom + 12 }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={90} tint="light" style={styles.sheet}>
              <View style={styles.handleBar} />

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{t('wizard.interestSubcategorySubtitle')}</Text>

              <ScrollView
                style={styles.chipsScroll}
                contentContainerStyle={styles.chipsContainer}
                showsVerticalScrollIndicator={false}
              >
                {options.map((opt) => {
                  const isSelected = selected.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.85}
                      onPress={() => toggle(opt.id)}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={opt.label}
                    >
                      {opt.iconName ? (
                        <View style={[styles.chipIconBubble, isSelected && styles.chipIconBubbleSelected]}>
                          <MaterialCommunityIcons
                            name={opt.iconName}
                            size={16}
                            color={isSelected ? '#FFFFFF' : colors.sunsetOrange}
                          />
                        </View>
                      ) : (
                        <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                      )}
                      <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.sunsetOrange}
                          style={styles.chipCheck}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAny}
                  style={styles.skipBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('wizard.interestSkipAny')}
                >
                  <Text style={styles.skipText}>{t('wizard.interestSkipAny')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleDone}
                  style={styles.doneBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('wizard.interestDone')}
                >
                  <Text style={styles.doneText}>
                    {t('wizard.interestDone')}
                    {selected.length > 0 ? ` · ${selected.length}` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheetWrap: {
    paddingHorizontal: 0,
  },
  sheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.headingBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.deepOcean,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  chipsScroll: {
    maxHeight: 320,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
  },
  chipSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderColor: colors.sunsetOrange,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipIconBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.paperWhite,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIconBubbleSelected: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  chipLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.deepOcean,
  },
  chipLabelSelected: {
    color: colors.deepOcean,
  },
  chipCheck: {
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  skipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.deepOcean,
  },
  doneBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunsetOrange,
  },
  doneText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
