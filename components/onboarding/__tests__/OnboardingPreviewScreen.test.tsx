/**
 * Onboarding screen 4 (value preview): shows a REAL curated plan (name + first
 * stops + a real cover photo pulled from the plan's stops), picked to match the
 * interests chosen on the tastes screen; falls back to a generic gradient card
 * when there is no showcase plan. The CTA finishes onboarding.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OnboardingPreviewScreen } from '../OnboardingPreviewScreen';
import { getShowcasePlans, getPlanDetail } from '../../../lib/api';
import { getOnboardingPrefsSync } from '../../../lib/onboarding-store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { city?: string }) => (opts?.city ? `${k}:${opts.city}` : k),
  }),
}));
jest.mock('../../../lib/api', () => ({
  getShowcasePlans: jest.fn(),
  getPlanDetail: jest.fn(),
}));
jest.mock('../../../lib/onboarding-store', () => ({
  getOnboardingPrefsSync: jest.fn(() => ({})),
}));
// Mock PhotoHero to a bare View that surfaces the props under test, so we can
// assert whether it receives a real photo URL or falls back to the gradient.
jest.mock('../../ui/PhotoHero', () => {
  const { View } = jest.requireActual('react-native');
  return {
    PhotoHero: ({ imageUrl, photoSource }: { imageUrl?: string; photoSource?: unknown }) => (
      <View testID="photo-hero" imageUrl={imageUrl ?? null} photoSource={photoSource ?? null} />
    ),
  };
});

const mockList = getShowcasePlans as jest.Mock;
const mockDetail = getPlanDetail as jest.Mock;
const mockPrefs = getOnboardingPrefsSync as jest.Mock;

// The five showcase plans curated in prod (list DTO shape: no photo field).
const SHOWCASE = [
  { id: 'romantic', name: 'Romantic Weekend in Miami', description: 'For two', type: 'romantic', tripContext: null },
  { id: 'foodie', name: 'Foodie Crawl', description: 'The best eats in town', type: 'foodie', tripContext: null },
  { id: 'outdoor', name: 'Outdoor Escape', description: 'Beaches and nature', type: 'outdoor', tripContext: null },
  { id: 'family', name: 'Family Day Out', description: 'Kid friendly stops', type: 'family', tripContext: null },
  { id: 'culture', name: 'Culture & Museums', description: 'Art and history', type: 'culture', tripContext: null },
];

const detailWithPhoto = (url: string) => ({
  data: {
    days: [
      {
        dayNumber: 1,
        stops: [
          { place: { name: 'Cafe A', category: 'Coffee', photos: null } },
          { place: { name: 'Beach B', category: 'Outdoors', photos: [url], photoSource: 'google' } },
        ],
      },
    ],
  },
  error: null,
  status: 200,
});

const detailNoPhoto = {
  data: {
    days: [
      {
        dayNumber: 1,
        stops: [
          { place: { name: 'Cafe A', category: 'Coffee', photos: null } },
          { place: { name: 'Beach B', category: 'Outdoors', photos: [] } },
        ],
      },
    ],
  },
  error: null,
  status: 200,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrefs.mockReturnValue({});
});

describe('OnboardingPreviewScreen', () => {
  it('renders the real plan name and its first stops', async () => {
    mockList.mockResolvedValueOnce({
      data: { plans: [{ id: 'p1', name: 'Miami Weekend', description: 'A curated weekend', type: 'foodie', tripContext: null }] },
      error: null,
      status: 200,
    });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    render(<OnboardingPreviewScreen city="Miami" onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Miami Weekend')).toBeTruthy());
    expect(screen.getByText('Cafe A')).toBeTruthy();
    expect(screen.getByText('Beach B')).toBeTruthy();
    expect(mockList).toHaveBeenCalledWith('Miami', expect.anything());
  });

  it('passes the first available stop photo (absolute R2 URL) to PhotoHero', async () => {
    const r2 = 'https://cdn.locallist.ai/photos/beach.jpg';
    mockList.mockResolvedValueOnce({ data: { plans: [SHOWCASE[0]] }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailWithPhoto(r2));

    render(<OnboardingPreviewScreen city={null} onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    const hero = screen.getByTestId('photo-hero');
    expect(hero.props.imageUrl).toBe(r2);
    expect(hero.props.photoSource).toBe('google');
  });

  it('selects the showcase plan matching the chosen interests (food → Foodie)', async () => {
    mockPrefs.mockReturnValue({ interests: ['food'] });
    mockList.mockResolvedValueOnce({ data: { plans: SHOWCASE }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    render(<OnboardingPreviewScreen city={null} onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Foodie Crawl')).toBeTruthy());
    expect(mockDetail).toHaveBeenCalledWith('foodie', expect.anything());
    expect(screen.queryByText('Romantic Weekend in Miami')).toBeNull();
  });

  it('falls back to plans[0] when the user picked no interests', async () => {
    mockPrefs.mockReturnValue({ interests: [] });
    mockList.mockResolvedValueOnce({ data: { plans: SHOWCASE }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    render(<OnboardingPreviewScreen city={null} onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    expect(mockDetail).toHaveBeenCalledWith('romantic', expect.anything());
  });

  it('shows the gradient (no photo) when the plan detail has no stop photos', async () => {
    mockList.mockResolvedValueOnce({ data: { plans: [SHOWCASE[0]] }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    render(<OnboardingPreviewScreen city={null} onCreatePlan={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    expect(screen.getByTestId('photo-hero').props.imageUrl).toBeNull();
  });

  it('falls back to a generic card when there is no showcase plan', async () => {
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
