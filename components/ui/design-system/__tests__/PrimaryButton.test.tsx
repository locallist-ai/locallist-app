/**
 * Design system — PrimaryButton.
 * Cubre el contrato de estados: label + icono MCI, onPress, y las guardas de
 * disabled/loading (no dispara) + el spinner de loading.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PrimaryButton } from '../PrimaryButton';

// MCI mockeado a un stub que expone su `name` como testID para poder aseverar
// que el icono se renderiza cuando se pasa `icon`.
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`mci-${name}`}>{name}</Text>;
  },
}));

describe('PrimaryButton', () => {
  it('renderiza el label', () => {
    render(<PrimaryButton label="Start Building" onPress={jest.fn()} />);
    expect(screen.getByText('Start Building')).toBeTruthy();
  });

  it('dispara onPress al pulsar cuando está habilitado', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Go" onPress={onPress} testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled NO dispara onPress', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Go" onPress={onPress} disabled testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading muestra spinner, oculta el label y NO dispara onPress', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Go" onPress={onPress} loading testID="btn" />);

    expect(screen.getByTestId('primary-button-spinner')).toBeTruthy();
    expect(screen.queryByText('Go')).toBeNull();

    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renderiza el icono MCI cuando se pasa `icon` (nunca emoji)', () => {
    render(<PrimaryButton label="Go" onPress={jest.fn()} icon="arrow-right" />);
    expect(screen.getByTestId('mci-arrow-right')).toBeTruthy();
  });

  it('sin `icon` no renderiza ningún glifo MCI', () => {
    render(<PrimaryButton label="Go" onPress={jest.fn()} />);
    expect(screen.queryByTestId('mci-arrow-right')).toBeNull();
  });
});
