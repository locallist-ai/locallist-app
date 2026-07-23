/**
 * Onboarding screen 1 (value): renders the three benefit bullets, the primary
 * CTA advances the flow, the secondary link opens the inline login.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OnboardingValueScreen } from '../OnboardingValueScreen';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('../../ui/design-system', () => {
  const { Text } = jest.requireActual('react-native');
  return { EditorialTitle: ({ text }: { text: string }) => <Text>{text}</Text> };
});

describe('OnboardingValueScreen', () => {
  it('renders the claim and the three value bullets', () => {
    render(<OnboardingValueScreen onStart={jest.fn()} onSignIn={jest.fn()} />);
    expect(screen.getByText('onboarding.valueClaim')).toBeTruthy();
    expect(screen.getByText('onboarding.valueBullet1')).toBeTruthy();
    expect(screen.getByText('onboarding.valueBullet2')).toBeTruthy();
    expect(screen.getByText('onboarding.valueBullet3')).toBeTruthy();
  });

  it('primary CTA calls onStart', () => {
    const onStart = jest.fn();
    render(<OnboardingValueScreen onStart={onStart} onSignIn={jest.fn()} />);
    fireEvent.press(screen.getByText('onboarding.getStarted'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('secondary link calls onSignIn (opens inline login)', () => {
    const onSignIn = jest.fn();
    render(<OnboardingValueScreen onStart={jest.fn()} onSignIn={onSignIn} />);
    fireEvent.press(screen.getByText('onboarding.haveAccount'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
