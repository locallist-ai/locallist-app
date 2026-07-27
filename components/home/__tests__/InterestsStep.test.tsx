/**
 * InterestsStep (multi-select de categorías + drill-down opcional por sheet).
 *
 * Contrato de CLICKS (Pablo 2026-07-27), paridad con el step de grupo:
 *  - El tap de un chip SOLO togglea la categoría (multi-select fluido) y NO
 *    auto-abre ningún sheet.
 *  - El refinamiento es opt-in (⋯) y su "Listo"/"Done" ENCADENA al siguiente step
 *    (guarda subs + cierra + avanza en un gesto), en vez de solo cerrar y obligar
 *    a un "Continuar" extra.
 *
 * Mutaciones que deben caer:
 *  - Quitar `onContinue()` de handleSheetConfirm → el assert de avance falla.
 *  - Re-introducir el auto-open en handleChipPress → el assert de "tap no abre
 *    sheet" falla.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { InterestsStep } from '../InterestsStep';

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
jest.mock('../../ui/design-system', () => ({
  EditorialTitle: () => null,
  StepSubtitle: () => null,
}));
// Taxonomía: "food" tiene subs (para que el ⋯ abra un sheet con opciones); el
// resto de categorías no aportan subs al test.
jest.mock('../useTaxonomy', () => ({
  useTaxonomy: () => ({}),
  taxonomyLocale: () => 'en',
  getInterestSubcategories: (id: string) =>
    id === 'food' ? [{ id: 'sushi', label: 'Sushi', emoji: '\u{1F363}' }] : [],
}));

// El contenido del SubcategorySheet vive bajo un Pressable con
// accessibilityElementsHidden; RNTL lo excluye de las queries por defecto.
const q = { includeHiddenElements: true } as const;

const renderStep = (overrides: Partial<React.ComponentProps<typeof InterestsStep>> = {}) => {
  const onToggleInterest = jest.fn();
  const onSetSubcategories = jest.fn();
  const onContinue = jest.fn();
  const onSkip = jest.fn();
  render(
    <InterestsStep
      interests={[]}
      subcategoryPicks={{}}
      onToggleInterest={onToggleInterest}
      onSetSubcategories={onSetSubcategories}
      onContinue={onContinue}
      onSkip={onSkip}
      {...overrides}
    />,
  );
  return { onToggleInterest, onSetSubcategories, onContinue, onSkip };
};

describe('InterestsStep — clicks y multi-select', () => {
  it('tap de un chip togglea la categoría y NO auto-abre el sheet (multi-select fluido)', () => {
    const { onToggleInterest, onContinue } = renderStep();

    fireEvent.press(screen.getByText('wizard.interestFood'));

    expect(onToggleInterest).toHaveBeenCalledWith('food');
    // Sin auto-open: el sheet (su botón "Listo") no debe existir tras el tap.
    expect(screen.queryByLabelText('wizard.interestDone', q)).toBeNull();
    // Y desde luego no ha avanzado el wizard por togglear un chip.
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('refinar vía ⋯ y pulsar "Listo" persiste subs Y AVANZA (encadena al siguiente step)', () => {
    // La categoría ya está elegida (interests=['food']) → aparece el ⋯ de refinar.
    const { onSetSubcategories, onContinue } = renderStep({ interests: ['food'] });

    // Abrir el sheet de refinamiento de forma explícita (opt-in), no automática.
    fireEvent.press(screen.getByLabelText('a11y.editSubcategories'));
    // Refinar dentro del sheet.
    fireEvent.press(screen.getByText('Sushi', q));

    // "Listo": guarda la selección Y avanza en UN gesto.
    fireEvent.press(screen.getByLabelText('wizard.interestDone', q));

    expect(onSetSubcategories).toHaveBeenCalledWith('food', ['sushi']);
    // Núcleo del fix: "Listo" AVANZA (no solo cierra el sheet).
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
