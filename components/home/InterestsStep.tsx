import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts, colors, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import {
  INTEREST_OPTIONS,
  SUBCATEGORIES_BY_INTEREST,
  type StepOption,
} from './constants';
import { SubcategorySheet } from './SubcategorySheet';

// Step de "interests" — multi-select de categorías top-level + drill-down a
// subcategorías por categoría. Renderizado por HomeV2 cuando step === 4.
//
// Diferencias con WizardStep (single-select):
//   - Multi-select: el usuario puede picar varias interests.
//   - Drill-down: al tap una con subcategorías disponibles, abre un
//     SubcategorySheet para refinar (ej. food → sushi, italian).
//   - No auto-advance: al ser multi, requiere botón "Continuar" explícito.
//   - Skip: avanza sin selecciones (interests es opcional para el min input).

interface InterestsStepProps {
  /** Categorías top-level seleccionadas (ids como 'food', 'outdoors'…). */
  interests: string[];
  /** Sub-selecciones por categoría: { food: ['sushi','italian'] }. */
  subcategoryPicks: Record<string, string[]>;
  /** Toggle interest top-level. Cuando agregamos un interest, opcionalmente abre el sheet. */
  onToggleInterest: (id: string) => void;
  /** Setter para sub-categorías de una interest concreta. */
  onSetSubcategories: (interestId: string, subs: string[]) => void;
  /** Avanza al siguiente step. */
  onContinue: () => void;
  /** Salta el step sin selecciones. */
  onSkip: () => void;
}

export const InterestsStep: React.FC<InterestsStepProps> = ({
  interests,
  subcategoryPicks,
  onToggleInterest,
  onSetSubcategories,
  onContinue,
  onSkip,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeSheet, setActiveSheet] = useState<StepOption | null>(null);

  const handleChipPress = (opt: StepOption) => {
    const wasSelected = interests.includes(opt.id);
    onToggleInterest(opt.id);
    // Si estamos AGREGANDO esta interest y tiene subcategorías disponibles,
    // abrir el sheet automáticamente para que el usuario pueda refinar.
    // Si la estamos quitando, no hacemos nada.
    const hasSubs = !!SUBCATEGORIES_BY_INTEREST[opt.id]?.length;
    if (!wasSelected && hasSubs) {
      setActiveSheet(opt);
    }
  };

  const handleEditSubs = (opt: StepOption) => {
    setActiveSheet(opt);
  };

  const handleSheetConfirm = (subs: string[]) => {
    if (activeSheet) {
      onSetSubcategories(activeSheet.id, subs);
    }
    setActiveSheet(null);
  };

  const handleSheetCancel = () => {
    setActiveSheet(null);
  };

  const subsForActive = activeSheet ? SUBCATEGORIES_BY_INTEREST[activeSheet.id] ?? [] : [];
  const initialSelectedForActive = activeSheet ? subcategoryPicks[activeSheet.id] ?? [] : [];

  return (
    <View style={styles.container}>
      <EditorialTitle
        text={t('wizard.stepInterestsTitle')}
        size="md"
        color="#FFFFFF"
        withShadow
        style={styles.titleSpacing}
      />
      <StepSubtitle
        text={t('wizard.stepInterestsSubtitle')}
        size="md"
        color="rgba(255, 255, 255, 0.7)"
        withShadow
        style={styles.subtitleSpacing}
      />

      <View style={styles.chipsGrid}>
        {INTEREST_OPTIONS.map((opt) => {
          const isSelected = interests.includes(opt.id);
          const subs = subcategoryPicks[opt.id] ?? [];
          const hasSubs = subs.length > 0;
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.85}
              onPress={() => handleChipPress(opt)}
              onLongPress={isSelected ? () => handleEditSubs(opt) : undefined}
              style={[styles.chip, isSelected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t(opt.labelKey)}
            >
              {opt.iconName ? (
                <View style={[styles.iconBubble, isSelected && styles.iconBubbleSelected]}>
                  <MaterialCommunityIcons
                    name={opt.iconName}
                    size={18}
                    color={isSelected ? '#FFFFFF' : colors.sunsetOrange}
                  />
                </View>
              ) : (
                <Text style={styles.chipEmoji}>{opt.emoji}</Text>
              )}
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                {t(opt.labelKey)}
              </Text>
              {isSelected && hasSubs && (
                <View style={styles.subBadge}>
                  <Text style={styles.subBadgeText}>+{subs.length}</Text>
                </View>
              )}
              {isSelected && (
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => handleEditSubs(opt)}
                  style={styles.editIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Edit subcategories"
                >
                  <Ionicons name="ellipsis-horizontal" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Continuar / Skip */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={interests.length > 0 ? onContinue : onSkip}
          style={styles.continueBtn}
          accessibilityRole="button"
          accessibilityLabel={
            interests.length > 0 ? t('wizard.interestContinue') : t('wizard.skip')
          }
        >
          <BlurView intensity={60} tint="light" style={styles.continueBlur}>
            <Text style={styles.continueText}>
              {interests.length > 0 ? t('wizard.interestContinue') : t('wizard.skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>
      </View>

      <SubcategorySheet
        visible={activeSheet !== null}
        parentLabel={activeSheet ? t(activeSheet.labelKey) : ''}
        options={subsForActive}
        initialSelected={initialSelectedForActive}
        onConfirm={handleSheetConfirm}
        onCancel={handleSheetCancel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSpacing: {
    marginBottom: 8,
  },
  subtitleSpacing: {
    marginBottom: 24,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chipSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.28)',
    borderColor: colors.sunsetOrange,
  },
  chipEmoji: {
    fontSize: 20,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 239, 233, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.18)',
  },
  iconBubbleSelected: {
    backgroundColor: colors.sunsetOrange,
    borderColor: colors.sunsetOrange,
  },
  chipLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  subBadge: {
    backgroundColor: colors.sunsetOrange,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: 2,
  },
  subBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  editIcon: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bottomActions: {
    marginTop: 20,
  },
  continueBtn: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  continueBlur: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  continueText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
