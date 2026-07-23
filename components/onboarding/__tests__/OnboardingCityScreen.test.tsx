/**
 * Onboarding screen 2 (city): offers the covered cities from /cities/live,
 * selecting one hands (name, covered=true) up, network failure keeps the bundled
 * catalog, and the notify-me hook (QW4 pending) reveals a local acknowledgement.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OnboardingCityScreen } from '../OnboardingCityScreen';
import { getLiveCities } from '../../../lib/api';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('../../../lib/api', () => ({ getLiveCities: jest.fn() }));
jest.mock('../../ui/design-system', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    EditorialTitle: ({ text }: { text: string }) => <Text>{text}</Text>,
    StepSubtitle: ({ text }: { text: string }) => <Text>{text}</Text>,
  };
});
jest.mock('../../home/CityCard', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    CityCard: ({ city, onSelect }: { city: { name: string }; onSelect: (n: string) => void }) => (
      <TouchableOpacity onPress={() => onSelect(city.name)}>
        <Text>{city.name}</Text>
      </TouchableOpacity>
    ),
  };
});

const mockGetLiveCities = getLiveCities as jest.Mock;
const liveOk = (names: string[]) => ({
  data: { cities: names.map((name) => ({ id: null, name, country: null })) },
  error: null,
  errorBody: null,
  status: 200,
});

beforeEach(() => jest.clearAllMocks());

describe('OnboardingCityScreen', () => {
  it('renders the covered cities from /cities/live', async () => {
    mockGetLiveCities.mockResolvedValueOnce(liveOk(['Miami', 'Lisboa']));
    render(<OnboardingCityScreen onSelectCity={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Lisboa')).toBeTruthy());
    expect(screen.getByText('Miami')).toBeTruthy();
  });

  it('selecting a city hands (name, covered=true) up', async () => {
    mockGetLiveCities.mockResolvedValueOnce(liveOk(['Miami']));
    const onSelectCity = jest.fn();
    render(<OnboardingCityScreen onSelectCity={onSelectCity} />);
    await waitFor(() => expect(screen.getByText('Miami')).toBeTruthy());
    fireEvent.press(screen.getByText('Miami'));
    expect(onSelectCity).toHaveBeenCalledWith('Miami', true);
  });

  it('keeps the bundled catalog (Miami) when the network fails', async () => {
    mockGetLiveCities.mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 });
    render(<OnboardingCityScreen onSelectCity={jest.fn()} />);
    expect(screen.getByText('Miami')).toBeTruthy();
    await waitFor(() => expect(mockGetLiveCities).toHaveBeenCalled());
    expect(screen.getByText('Miami')).toBeTruthy();
  });

  it('notify-me reveals a local acknowledgement (QW4 hook)', async () => {
    mockGetLiveCities.mockResolvedValueOnce(liveOk(['Miami']));
    render(<OnboardingCityScreen onSelectCity={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Miami')).toBeTruthy());
    fireEvent.press(screen.getByText('onboarding.cityNotListed'));
    expect(screen.getByText('onboarding.cityNotifyThanks')).toBeTruthy();
  });
});
