import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts, colors, borderRadius } from '../../lib/theme';
import { EditorialTitle, StepSubtitle } from '../ui/design-system';
import { OptionCard } from './OptionCard';
import { SubcategorySheet } from './SubcategorySheet';
import type { WizardStepConfig, SubcategoryOption } from './constants';

// Step single-select con drill-down opcional. Reutilizable para Company y
// Style — donde el usuario elige UN parent (solo/couple/family,
// adventure/relax/cultural) y opcionalmente refina con un sheet de sub-tags.
//
// Flujo:
//   1. Usuario tap parent chip → se selecciona (single-select).
//   2. Si el parent tiene sub-options en `subOptionsByParent` → abre sheet.
//   3. Usuario confirma subs (o salta con "Cualquiera") → cierra sheet → onContinue.
//   4. Usuario puede re-tap el parent seleccionado (o el icono ⋯) para editar subs.
//   5. Skip button avanza sin selección.

interface RefineableStepProps {
  config: WizardStepConfig;
  selectedId: string | null;
  /** Sub-options disponibles, keyed por parent id. Si vacío para un parent,
   *  ese parent NO abre sheet — auto-advance directo. */
  subOptionsByParent: Record<string, SubcategoryOption[]>;
  /** Sub-tags actualmente activos para el parent seleccionado. */
  selectedSubs: string[];
  /** Persiste la selección del parent. */
  onSelect: (parentId: string) => void;
  /** Persiste los sub-tags del parent activo. */
  onSetSubs: (subs: string[]) => void;
  /** Avanza al siguiente step (tras cerrar el sheet o skip). */
  onContinue: () => void;
}

export const RefineableStep: React.FC<RefineableStepProps> = ({
  config,
  selectedId,
  subOptionsByParent,
  selectedSubs,
  onSelect,
  onSetSubs,
  onContinue,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeSheetParent, setActiveSheetParent] = useState<string | null>(null);

  const handlePress = (parentId: string) => {
    const subs = subOptionsByParent[parentId];
    const hasSubs = !!subs?.length;

    onSelect(parentId);

    if (hasSubs) {
      // Si cambia de parent o aún no se eligieron subs, abrir sheet para
      // refinamiento opcional. Si re-tap del mismo parent ya seleccionado,
      // también abrir para editar.
      setActiveSheetParent(parentId);
    }
    // Pablo 2026-04-26: NO auto-advance. El usuario pulsa Continue/Skip
    // del bottom para avanzar al siguiente step.
  };

  const handleSheetConfirm = (subs: string[]) => {
    onSetSubs(subs);
    setActiveSheetParent(null);
    // No auto-advance — el usuario sigue en este step hasta pulsar Continue.
  };

  const handleSheetCancel = () => {
    setActiveSheetParent(null);
    // No avanzar — usuario canceló, queda en este step.
  };

  const activeSubs = activeSheetParent ? subOptionsByParent[activeSheetParent] ?? [] : [];
  const activeParentLabel = activeSheetParent
    ? t(config.options.find((o) => o.id === activeSheetParent)?.labelKey ?? 'wizard.skip')
    : '';

  return (
    <View style={styles.container}>
      <EditorialTitle
        text={t(config.titleKey)}
        size="md"
        color="#FFFFFF"
        withShadow
        style={styles.titleSpacing}
      />
      <StepSubtitle
        text={t(config.subtitleKey)}
        size="md"
        color="rgba(255, 255, 255, 0.7)"
        withShadow
        style={styles.subtitleSpacing}
      />

      <View>
        {config.options.map((option, index) => {
          const isSelected = selectedId === option.id;
          const subsForThis = isSelected ? selectedSubs : [];
          const hasSubsAvailable = !!subOptionsByParent[option.id]?.length;
          return (
            <View key={option.id} style={styles.cardWrap}>
              <OptionCard
                option={option}
                index={index}
                selected={isSelected}
                onSelect={() => handlePress(option.id)}
              />
              {isSelected && hasSubsAvailable && (
                <View style={styles.refinementRow}>
                  <TouchableOpacity
                    onPress={() => setActiveSheetParent(option.id)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Edit refinement"
                    style={styles.editBtn}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.sunsetOrange} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.skipWrapper, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onContinue}
          style={styles.skipButton}
          accessibilityLabel={selectedId ? t('wizard.interestContinue') : t('wizard.skip')}
          accessibilityRole="button"
        >
          <BlurView intensity={60} tint="light" style={styles.skipBlur}>
            <Text style={styles.skipText}>
              {selectedId ? t('wizard.interestContinue') : t('wizard.skip')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </BlurView>
        </TouchableOpacity>
      </View>

      <SubcategorySheet
        visible={activeSheetParent !== null}
        parentLabel={activeParentLabel}
        options={activeSubs}
        initialSelected={
          activeSheetParent && activeSheetParent === selectedId ? selectedSubs : []
        }
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
  cardWrap: {
    marginBottom: 8,
  },
  refinementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 4,
    marginTop: -4,
    marginBottom: 4,
  },
  editBtn: {
    width: 28,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.sunsetOrange + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWrapper: {
    marginTop: 20,
  },
  skipButton: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  skipBlur: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
});
