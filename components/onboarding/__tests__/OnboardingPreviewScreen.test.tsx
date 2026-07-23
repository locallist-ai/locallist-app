/**
 * Onboarding screen 4 (value preview): shows a real curated plan (name + first
 * stops) for the chosen city, falls back to a generic card when the city has no
 * showcase plan, and the CTA finishes onboarding.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OnboardingPreviewScreen } from '../OnboardingPreviewScreen';
import { getShowcasePlans, getPlanDetail } from '../../../lib/api';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { city?: string }) => (opts?.city ? `${k}:${opts.city}` : k),
  }),
}));
jest.mock('../../../lib/api', () => ({
  getShowcasePlans: jest.fn(),
  getPlanDetail: jest.fn(),
}));
jest.mock('../../ui/PhotoHero', () => {
  const { View } = jest.requireActual('react-native');
  return { PhotoHero: () => <View testID="photo-hero" /> };
});

const mockList = getShowcasePlans as jest.Mock;
const mockDetail = getPlanDetail as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('OnboardingPreviewScreen', () => {
  it('renders the real plan name and its first stops', async () => {
    mockList.mockResolvedValueOnce({
      data: { plans: [{ id: 'p1', name: 'Miami Weekend', description: 'A curated weekend', category: 'Food', image: null }] },
      error: null,
      status: 200,
    });
    mockDetail.mockResolvedValueOnce({
      data: {
        days: [
          {
            dayNumber: 1,
            stops: [
              { place: { name: 'Cafe A', category: 'Coffee' } },
              { place: { name: 'Beach B', category: 'Outdoors' } },
            ],
          },
        ],
      },
      error: null,
      status: 200,
    });

    render(<OnboardingPreviewScreen city="Miami" onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Miami Weekend')).toBeTruthy());
    expect(screen.getByText('Cafe A')).toBeTruthy();
    expect(screen.getByText('Beach B')).toBeTruthy();
    expect(mockList).toHaveBeenCalledWith('Miami', expect.anything());
  });

  it('falls back to a generic card when the city has no showcase plan', async () => {
    mockList.mockResolvedValueOnce({ data: { plans: [] }, error: null, status: 200 });

    render(<OnboardingPreviewScreen city="Miami" onCreatePlan={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('onboarding.previewGenericTitle:Miami')).toBeTruthy(),
    );
    // Never fetches detail when there is no plan.
    expect(mockDetail).not.toHaveBeenCalled();
  });

  it('CTA finishes onboarding', async () => {
    mockList.mockResolvedValueOnce({ data: { plans: [] }, error: null, status: 200 });
    const onCreatePlan = jest.fn();
    render(<OnboardingPreviewScreen city="Miami" onCreatePlan={onCreatePlan} />);
    await waitFor(() => expect(screen.getByText('onboarding.createPlan')).toBeTruthy());
    fireEvent.press(screen.getByText('onboarding.createPlan'));
    expect(onCreatePlan).toHaveBeenCalledTimes(1);
  });
});
