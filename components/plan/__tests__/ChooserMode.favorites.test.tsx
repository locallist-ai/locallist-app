/**
 * Entrada de Favoritos en el chooser del tab Plans: la tarjeta "Favoritos"
 * siempre se pinta (invitado incluido) y llama a onFavorites al tocar. Con
 * count > 0 (autenticado) muestra el subtítulo con el recuento.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ChooserMode } from '../ChooserMode';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${opts.count}` : key,
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null, MaterialCommunityIcons: () => null }));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
  };
});
jest.mock('../../ui/design-system', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    EditorialTitle: ({ text }: { text: string }) => <Text>{text}</Text>,
    StepSubtitle: ({ text }: { text: string }) => <Text>{text}</Text>,
  };
});

const insets = { top: 0, bottom: 0, left: 0, right: 0 };

const baseProps = {
  insets,
  onExploreCurated: jest.fn(),
  onBuildOwn: jest.fn(),
  onImportVideo: jest.fn(),
  onMyPlans: jest.fn(),
};

describe('ChooserMode — tarjeta de favoritos', () => {
  it('invitado: la tarjeta se pinta y onFavorites se dispara al tocar', () => {
    const onFavorites = jest.fn();
    render(
      <ChooserMode
        {...baseProps}
        isAuthenticated={false}
        myPlansCount={0}
        favoritesCount={0}
        onFavorites={onFavorites}
      />,
    );

    // Título de la tarjeta presente.
    expect(screen.getByText('favorites.title')).toBeTruthy();
    // Subtítulo genérico (sin count) para invitado.
    expect(screen.getByText('favorites.chooserSub')).toBeTruthy();

    fireEvent.press(screen.getByText('favorites.title'));
    expect(onFavorites).toHaveBeenCalledTimes(1);
  });

  it('autenticado con count > 0: subtítulo con recuento', () => {
    render(
      <ChooserMode
        {...baseProps}
        isAuthenticated
        myPlansCount={2}
        favoritesCount={5}
        onFavorites={jest.fn()}
      />,
    );

    expect(screen.getByText('favorites.savedCount:5')).toBeTruthy();
  });
});
