/**
 * Deferred onboarding-prefs → profile sync (`lib/onboarding-sync`).
 *
 *  - `mapPrefsToProfile` maps only the profile-relevant fields and returns null
 *    when nothing maps (so the caller skips the network round trip).
 *  - `syncOnboardingPrefsToProfile` PUTs the mapped profile then clears prefs on
 *    success; on error it keeps them for a retry on the next login.
 */
import { mapPrefsToProfile, syncOnboardingPrefsToProfile } from '../onboarding-sync';
import { upsertProfile } from '../api';
import { getOnboardingPrefsSync, clearOnboardingPrefs } from '../onboarding-store';

jest.mock('../api', () => ({ upsertProfile: jest.fn() }));
jest.mock('../onboarding-store', () => ({
  getOnboardingPrefsSync: jest.fn(),
  clearOnboardingPrefs: jest.fn(() => Promise.resolve()),
}));
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockUpsert = upsertProfile as jest.Mock;
const mockGetPrefs = getOnboardingPrefsSync as jest.Mock;
const mockClear = clearOnboardingPrefs as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('mapPrefsToProfile', () => {
  it('maps budget/pace/dietary to the profile upsert shape', () => {
    expect(
      mapPrefsToProfile({
        budget: 'moderate',
        pace: 'relaxed',
        dietary: ['vegan'],
        interests: ['food'],
      }),
    ).toEqual({
      defaultBudgetTier: 'moderate',
      pacePreference: 'relaxed',
      dietaryRestrictions: ['vegan'],
    });
  });

  it('ignores interests-only prefs (no profile field) and returns null', () => {
    expect(mapPrefsToProfile({ interests: ['food', 'coffee'] })).toBeNull();
  });

  it('drops empty dietary arrays and returns null for empty prefs', () => {
    expect(mapPrefsToProfile({ dietary: [] })).toBeNull();
    expect(mapPrefsToProfile({})).toBeNull();
  });

  it('maps a partial pref (budget only)', () => {
    expect(mapPrefsToProfile({ budget: 'premium' })).toEqual({ defaultBudgetTier: 'premium' });
  });

  // MINOR-1: a deselected budget is persisted as `null`. The deferred sync must
  // treat it like an unset field, never send a phantom `defaultBudgetTier`.
  it('does not send defaultBudgetTier when budget is null', () => {
    expect(mapPrefsToProfile({ budget: null, pace: 'relaxed' })).toEqual({ pacePreference: 'relaxed' });
    expect(mapPrefsToProfile({ budget: null })).toBeNull();
  });
});

describe('syncOnboardingPrefsToProfile', () => {
  it('does nothing (no PUT, no clear) when nothing maps', async () => {
    mockGetPrefs.mockReturnValue({ interests: ['food'] });
    await syncOnboardingPrefsToProfile();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('PUTs the mapped profile then clears prefs on success', async () => {
    mockGetPrefs.mockReturnValue({ budget: 'premium', dietary: ['vegan'] });
    mockUpsert.mockResolvedValue({ data: { defaultBudgetTier: 'premium' }, error: null, status: 200 });

    await syncOnboardingPrefsToProfile();

    expect(mockUpsert).toHaveBeenCalledWith({ defaultBudgetTier: 'premium', dietaryRestrictions: ['vegan'] });
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('keeps prefs (no clear) when the PUT fails', async () => {
    mockGetPrefs.mockReturnValue({ budget: 'premium' });
    mockUpsert.mockResolvedValue({ data: null, error: 'HTTP 500', status: 500 });

    await syncOnboardingPrefsToProfile();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockClear).not.toHaveBeenCalled();
  });
});
