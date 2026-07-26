/**
 * Entrada de Favoritos en Account: la fila "Favoritos" navega (onFavorites).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SettingsSection } from '../SettingsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

describe('SettingsSection — fila de favoritos', () => {
  it('la fila "Favoritos" llama a onFavorites al tocar', () => {
    const onFavorites = jest.fn();
    render(
      <SettingsSection
        currentLangLabel="English"
        onOpenLanguage={jest.fn()}
        onFavorites={onFavorites}
        onLogout={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('favorites.title'));
    expect(onFavorites).toHaveBeenCalledTimes(1);
  });
});
