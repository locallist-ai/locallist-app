/**
 * Onboarding screen 4 (value preview): shows a REAL curated plan (name + first
 * stops + a real cover photo pulled from the plan's stops), picked to match the
 * interests chosen on the tastes screen; falls back to a generic gradient card
 * when there is no showcase plan.
 *
 * The PRIMARY CTA is now "Save this plan" (the registration hook): a guest tap
 * stages the clone intent and asks the orchestrator to present signup; an
 * authenticated tap clones directly, stages the landing id, and completes. The
 * SECONDARY "not now" link keeps the old continue-without-saving path.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OnboardingPreviewScreen } from '../OnboardingPreviewScreen';
import { getShowcasePlans, getPlanDetail, clonePlan } from '../../../lib/api';
import { getOnboardingPrefsSync } from '../../../lib/onboarding-store';
import { track } from '../../../lib/analytics';
import { setPendingClonePlan, setPendingCloneLanding } from '../../../lib/clone-plan-store';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { city?: string }) => (opts?.city ? `${k}:${opts.city}` : k),
  }),
}));
jest.mock('../../../lib/api', () => ({
  getShowcasePlans: jest.fn(),
  getPlanDetail: jest.fn(),
  clonePlan: jest.fn(),
}));
jest.mock('../../../lib/onboarding-store', () => ({
  getOnboardingPrefsSync: jest.fn(() => ({})),
}));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../../lib/clone-plan-store', () => ({
  setPendingClonePlan: jest.fn(),
  setPendingCloneLanding: jest.fn(),
}));
// Auth state is controlled per-test via `mockIsAuthed`.
let mockIsAuthed = false;
jest.mock('../../../lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthed }),
}));
const mockPresentGate = jest.fn();
jest.mock('../../../lib/useGateHandler', () => ({
  useGateHandler: () => ({ presentGate: mockPresentGate, presentClamped: jest.fn() }),
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
const mockClone = clonePlan as jest.Mock;
const mockPrefs = getOnboardingPrefsSync as jest.Mock;
const mockTrack = track as jest.Mock;
const mockSetPending = setPendingClonePlan as jest.Mock;
const mockSetLanding = setPendingCloneLanding as jest.Mock;

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

// Render helper with the required callbacks defaulted to spies; individual tests
// override what they assert on.
function renderScreen(
  props: Partial<React.ComponentProps<typeof OnboardingPreviewScreen>> = {},
) {
  const onCreatePlan = props.onCreatePlan ?? jest.fn();
  const onRequestSignup = props.onRequestSignup ?? jest.fn();
  const onSaved = props.onSaved ?? jest.fn();
  render(
    <OnboardingPreviewScreen
      city={props.city ?? null}
      onCreatePlan={onCreatePlan}
      onRequestSignup={onRequestSignup}
      onSaved={onSaved}
    />,
  );
  return { onCreatePlan, onRequestSignup, onSaved };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthed = false;
  mockPrefs.mockReturnValue({});
});

describe('OnboardingPreviewScreen — preview rendering', () => {
  it('renders the real plan name and its first stops', async () => {
    mockList.mockResolvedValueOnce({
      data: { plans: [{ id: 'p1', name: 'Miami Weekend', description: 'A curated weekend', type: 'foodie', tripContext: null }] },
      error: null,
      status: 200,
    });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    renderScreen({ city: 'Miami' });

    await waitFor(() => expect(screen.getByText('Miami Weekend')).toBeTruthy());
    expect(screen.getByText('Cafe A')).toBeTruthy();
    expect(screen.getByText('Beach B')).toBeTruthy();
    expect(mockList).toHaveBeenCalledWith('Miami', expect.anything());
  });

  it('passes the first available stop photo (absolute R2 URL) to PhotoHero', async () => {
    const r2 = 'https://cdn.locallist.ai/photos/beach.jpg';
    mockList.mockResolvedValueOnce({ data: { plans: [SHOWCASE[0]] }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailWithPhoto(r2));

    renderScreen();

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    const hero = screen.getByTestId('photo-hero');
    expect(hero.props.imageUrl).toBe(r2);
    expect(hero.props.photoSource).toBe('google');
  });

  it('selects the showcase plan matching the chosen interests (food → Foodie)', async () => {
    mockPrefs.mockReturnValue({ interests: ['food'] });
    mockList.mockResolvedValueOnce({ data: { plans: SHOWCASE }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Foodie Crawl')).toBeTruthy());
    expect(mockDetail).toHaveBeenCalledWith('foodie', expect.anything());
    expect(screen.queryByText('Romantic Weekend in Miami')).toBeNull();
  });

  it('falls back to plans[0] when the user picked no interests', async () => {
    mockPrefs.mockReturnValue({ interests: [] });
    mockList.mockResolvedValueOnce({ data: { plans: SHOWCASE }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    expect(mockDetail).toHaveBeenCalledWith('romantic', expect.anything());
  });

  it('shows the gradient (no photo) when the plan detail has no stop photos', async () => {
    mockList.mockResolvedValueOnce({ data: { plans: [SHOWCASE[0]] }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    expect(screen.getByTestId('photo-hero').props.imageUrl).toBeNull();
  });

  it('falls back to a generic card when there is no showcase plan', async () => {
    mockList.mockResolvedValueOnce({ data: { plans: [] }, error: null, status: 200 });

    renderScreen({ city: 'Miami' });

    await waitFor(() =>
      expect(screen.getByText('onboarding.previewGenericTitle:Miami')).toBeTruthy(),
    );
    // Never fetches detail when there is no plan.
    expect(mockDetail).not.toHaveBeenCalled();
  });
});

describe('OnboardingPreviewScreen — save-this-plan hook', () => {
  // Load a concrete showcase plan (id 'romantic') for the save tests.
  const renderWithPlan = async (
    props: Partial<React.ComponentProps<typeof OnboardingPreviewScreen>> = {},
  ) => {
    mockList.mockResolvedValueOnce({ data: { plans: [SHOWCASE[0]] }, error: null, status: 200 });
    mockDetail.mockResolvedValueOnce(detailNoPhoto);
    const spies = renderScreen(props);
    await waitFor(() => expect(screen.getByText('Romantic Weekend in Miami')).toBeTruthy());
    return spies;
  };

  it('(a) authenticated: tap clones the plan, stages the landing id, and completes', async () => {
    mockIsAuthed = true;
    mockClone.mockResolvedValueOnce({ data: { id: 'cloned-1' }, error: null, status: 200 });
    const { onSaved, onRequestSignup } = await renderWithPlan();

    fireEvent.press(screen.getByText('onboarding.savePlan'));

    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_save_plan_tapped' });
    await waitFor(() => expect(mockClone).toHaveBeenCalledWith('romantic'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: false });
    expect(mockSetLanding).toHaveBeenCalledWith('cloned-1');
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // Authenticated path never routes through signup or stages a guest pending.
    expect(onRequestSignup).not.toHaveBeenCalled();
    expect(mockSetPending).not.toHaveBeenCalled();
  });

  it('(b) guest: tap stages the pending clone + requests signup, WITHOUT cloning', async () => {
    mockIsAuthed = false;
    const { onRequestSignup, onSaved } = await renderWithPlan();

    fireEvent.press(screen.getByText('onboarding.savePlan'));

    expect(mockTrack).toHaveBeenCalledWith({ event: 'onboarding_save_plan_tapped' });
    expect(mockSetPending).toHaveBeenCalledWith('romantic');
    expect(onRequestSignup).toHaveBeenCalledTimes(1);
    // A guest never hits the network and never completes here.
    expect(mockClone).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalledWith({ event: 'onboarding_plan_saved', viaSignup: expect.anything() });
  });

  it('(d) authenticated: a 403 saved_plans_limit shows the Plus upsell, does not complete', async () => {
    mockIsAuthed = true;
    mockClone.mockResolvedValueOnce({
      data: null,
      error: 'saved_plans_limit_reached',
      errorBody: { error: 'saved_plans_limit_reached', limit: 3 },
      status: 403,
    });
    const { onSaved } = await renderWithPlan();

    fireEvent.press(screen.getByText('onboarding.savePlan'));

    await waitFor(() => expect(mockPresentGate).toHaveBeenCalledTimes(1));
    const action = mockPresentGate.mock.calls[0][0];
    expect(action).toMatchObject({ type: 'upsell', code: 'saved_plans_limit_reached' });
    expect(mockSetLanding).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('(e) authenticated: a network failure does not crash — completes onboarding (lands home)', async () => {
    mockIsAuthed = true;
    mockClone.mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 });
    const { onSaved } = await renderWithPlan();

    fireEvent.press(screen.getByText('onboarding.savePlan'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockSetLanding).not.toHaveBeenCalled();
    expect(mockPresentGate).not.toHaveBeenCalled();
  });

  it('(f) the "not now" link continues without saving (onCreatePlan)', async () => {
    const { onCreatePlan, onRequestSignup } = await renderWithPlan();

    fireEvent.press(screen.getByText('onboarding.saveNotNow'));

    expect(onCreatePlan).toHaveBeenCalledTimes(1);
    expect(mockClone).not.toHaveBeenCalled();
    expect(mockSetPending).not.toHaveBeenCalled();
    expect(onRequestSignup).not.toHaveBeenCalled();
  });
});
