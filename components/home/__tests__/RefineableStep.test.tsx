/**
 * RefineableStep (company step, single-select con drill-down sheet).
 *
 * Contrato de CLICKS (Pablo 2026-07-27): el "Listo"/"Done" del SubcategorySheet
 * ENCADENA directo al siguiente step del wizard en vez de solo cerrar el sheet y
 * dejar al usuario teniendo que pulsar "Continuar". Un gesto en vez de dos.
 *
 * Mutación que debe caer: si `handleSheetConfirm` vuelve al comportamiento viejo
 * (solo `setActiveSheetParent(null)`, sin `onContinue()`), el test de avance
 * falla porque `onContinue` no se llama.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RefineableStep } from '../RefineableStep';
import { STEPS, COMPANY_SUBCATEGORIES } from '../constants';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = { duration: () => chain, easing: () => chain, delay: () => chain };
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain,
    FadeOut: chain,
    SlideInDown: chain,
    SlideOutDown: chain,
    Easing: { out: () => ({}), in: () => ({}), cubic: {} },
  };
});
// Design-system: EditorialTitle/StepSubtitle no aportan al test; ChoiceChip se
// mockea a un pressable con el label para poder tap el parent (solo/couple/...).
jest.mock('../../ui/design-system', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    EditorialTitle: () => null,
    StepSubtitle: () => null,
    ChoiceChip: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        <Text>{label}</Text>
      </TouchableOpacity>
    ),
  };
});

// El contenido del sheet vive bajo un Pressable con accessibilityElementsHidden;
// RNTL lo excluye de las queries por defecto (igual que SubcategorySheet.i18n.test).
const q = { includeHiddenElements: true } as const;

const renderCompanyStep = (overrides: Partial<React.ComponentProps<typeof RefineableStep>> = {}) => {
  const onSelect = jest.fn();
  const onSetSubs = jest.fn();
  const onContinue = jest.fn();
  render(
    <RefineableStep
      config={STEPS[1]}
      selectedId={null}
      subOptionsByParent={COMPANY_SUBCATEGORIES}
      selectedSubs={[]}
      onSelect={onSelect}
      onSetSubs={onSetSubs}
      onContinue={onContinue}
      mode="single"
      {...overrides}
    />,
  );
  return { onSelect, onSetSubs, onContinue };
};

describe('RefineableStep — el "Listo" del sheet encadena al siguiente step', () => {
  it('tap parent → refinar → "Listo" persiste subs Y AVANZA (llama onContinue)', () => {
    const { onSelect, onSetSubs, onContinue } = renderCompanyStep();

    // 1. Tap el parent "couple" → selecciona y abre el sheet de refinamiento.
    fireEvent.press(screen.getByText('wizard.companyCouple'));
    expect(onSelect).toHaveBeenCalledWith('couple');

    // 2. Refinar dentro del sheet (single-select): elegir "honeymoon".
    fireEvent.press(screen.getByText('wizard.companySubHoneymoon', q));

    // 3. "Listo" del sheet: debe guardar la selección Y avanzar en UN gesto.
    fireEvent.press(screen.getByLabelText('wizard.interestDone', q));

    expect(onSetSubs).toHaveBeenCalledWith(['honeymoon']);
    // Núcleo del fix: "Listo" AVANZA (no solo cierra el sheet).
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('"Listo" sin refinar (subs vacías) también AVANZA — camino de mínimos clicks', () => {
    const { onSetSubs, onContinue } = renderCompanyStep();

    fireEvent.press(screen.getByText('wizard.companySolo'));
    fireEvent.press(screen.getByLabelText('wizard.interestDone', q));

    expect(onSetSubs).toHaveBeenCalledWith([]);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
