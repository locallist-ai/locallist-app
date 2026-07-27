/**
 * Behavioural tests for the owner "Share plan" affordance (Social S1).
 * Covers: (a) the pure visibility gate (owner vs reader/new); (b) tap ⇒ POST
 * /share ⇒ native Share sheet with the canonical token URL + analytics; (c)
 * idempotency (second tap re-shares without breaking; same-frame double tap
 * fires one POST); (d) revoke ⇒ ActionSheet ⇒ ConfirmModal ⇒ DELETE + feedback;
 * (e) network error ⇒ retriable alert, no crash, no share sheet; (f) i18n parity.
 */
import React from 'react';
import { ActionSheetIOS, Alert, Share, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ShareButton, shouldShowShareButton } from '../ShareButton';
import { sharePlan, unsharePlan } from '../../../lib/api';
import { track } from '../../../lib/analytics';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';

jest.mock('react-i18next', () => ({
  // Interpolates {{url}} so the share message carries the real link.
  useTranslation: () => ({
    t: (k: string, opts?: { url?: string }) => (opts?.url ? `${k} ${opts.url}` : k),
  }),
}));
jest.mock('../../../lib/api', () => ({ sharePlan: jest.fn(), unsharePlan: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const mockSharePlan = sharePlan as jest.Mock;
const mockUnshare = unsharePlan as jest.Mock;
const mockTrack = track as jest.Mock;

const shareOk = (shareToken: string, visibility = 'unlisted') => ({
  data: { shareToken, visibility },
  error: null,
  errorBody: null,
  status: 200,
});
const netFail = { data: null, error: 'Network error', errorBody: null, status: 0 };

const LINK = 'https://locallist.ai/p/tok_abc';

let shareSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
let actionSheetSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  actionSheetSpy = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation(() => {});
});

afterEach(() => {
  shareSpy.mockRestore();
  alertSpy.mockRestore();
  actionSheetSpy.mockRestore();
});

const getButton = () => screen.getByLabelText('share.a11yShare');

describe('shouldShowShareButton (visibility gate)', () => {
  it('(a) owner of a persisted plan sees the button', () => {
    expect(shouldShowShareButton({ isNew: false, isOwner: true, planId: 'p1' })).toBe(true);
  });
  it('(a) a reader / non-owner never sees it', () => {
    expect(shouldShowShareButton({ isNew: false, isOwner: false, planId: 'p1' })).toBe(false);
  });
  it('(a) a brand-new draft is not shareable', () => {
    expect(shouldShowShareButton({ isNew: true, isOwner: true, planId: 'new' })).toBe(false);
  });
  it('(a) the preview handoff IS shareable once its backend id resolves (already persisted)', () => {
    // /plan/preview: isNew=false and planId=the resolved backend id.
    expect(
      shouldShowShareButton({ isNew: false, isOwner: true, planId: 'resolved-from-preview' }),
    ).toBe(true);
  });
  it('(a) no resolved plan id ⇒ hidden', () => {
    expect(shouldShowShareButton({ isNew: false, isOwner: true, planId: null })).toBe(false);
  });
});

describe('ShareButton', () => {
  it('(a) renders an accessible share button for the owner', () => {
    render(<ShareButton planId="p1" />);
    expect(getButton()).toBeTruthy();
  });

  it('(b) tap ⇒ POST /share ⇒ native Share sheet with the token URL + analytics', async () => {
    mockSharePlan.mockResolvedValueOnce(shareOk('tok_abc'));
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());

    await waitFor(() => expect(mockSharePlan).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    const arg = shareSpy.mock.calls[0][0];
    expect(arg.url).toBe(LINK);
    expect(arg.message).toContain(LINK);
    expect(mockTrack).toHaveBeenCalledWith({ event: 'plan_share_opened' });
  });

  it('(b) user cancelling the sheet is a silent no-op (no crash)', async () => {
    mockSharePlan.mockResolvedValueOnce(shareOk('tok_abc'));
    shareSpy.mockResolvedValueOnce({ action: 'dismissedAction' } as never);
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('(c) a second tap re-shares (idempotent token) without breaking', async () => {
    mockSharePlan.mockResolvedValue(shareOk('tok_abc'));
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(2));
    expect(mockSharePlan).toHaveBeenCalledTimes(2);
  });

  it('(c) two immediate taps fire a single POST (disabled guard + latch combined)', async () => {
    // NOT an isolated latch test: fireEvent.press flushes the setBusy re-render
    // between taps, so `disabled` already blocks the second press. The isolated
    // latch case is below.
    let resolve!: (v: unknown) => void;
    mockSharePlan.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<ShareButton planId="p1" />);
    const btn = getButton();
    fireEvent.press(btn);
    fireEvent.press(btn);
    expect(mockSharePlan).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(shareOk('tok_abc')); });
  });

  it('(c) same-closure double invocation fires a single POST (in-flight latch isolated)', async () => {
    // Two synchronous calls to the SAME render's onPress closure: no re-render
    // between them, so `disabled` cannot intervene and only the inFlight ref
    // latch stops the second POST (CityRequestInline pattern).
    let resolve!: (v: unknown) => void;
    mockSharePlan.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    render(<ShareButton planId="p1" />);
    const onPress = screen.UNSAFE_getByType(TouchableOpacity).props.onPress as () => void;
    await act(async () => {
      onPress();
      onPress();
    });
    expect(mockSharePlan).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(shareOk('tok_abc')); });
    expect(mockSharePlan).toHaveBeenCalledTimes(1);
  });

  it('(d) long-press once shared ⇒ ActionSheet ⇒ revoke ⇒ ConfirmModal ⇒ DELETE + feedback', async () => {
    mockSharePlan.mockResolvedValueOnce(shareOk('tok_abc'));
    mockUnshare.mockResolvedValueOnce({ data: null, error: null, errorBody: null, status: 204 });
    render(<ShareButton planId="p1" />);

    // Share first so the button knows the plan is shared (enables revoke).
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());

    // Long-press opens the ActionSheet; pick "Stop sharing" (index 1).
    actionSheetSpy.mockImplementationOnce((_opts, cb: (i: number) => void) => cb(1));
    fireEvent(getButton(), 'longPress');

    // Confirmation modal appears; confirm the revoke.
    const confirm = await screen.findByText('share.revokeConfirm');
    fireEvent.press(confirm);

    await waitFor(() => expect(mockUnshare).toHaveBeenCalledWith('p1'));
    expect(mockTrack).toHaveBeenCalledWith({ event: 'plan_share_revoked' });
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('share.revokedTitle', 'share.revokedBody'),
    );
  });

  it('(d) revoke can be cancelled from the ConfirmModal (no DELETE)', async () => {
    mockSharePlan.mockResolvedValueOnce(shareOk('tok_abc'));
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());

    actionSheetSpy.mockImplementationOnce((_opts, cb: (i: number) => void) => cb(1));
    fireEvent(getButton(), 'longPress');
    const cancel = await screen.findByText('common.cancel');
    fireEvent.press(cancel);
    expect(mockUnshare).not.toHaveBeenCalled();
  });

  it('(d) revoke network error shows a retriable alert (mirrors the POST path)', async () => {
    mockSharePlan.mockResolvedValueOnce(shareOk('tok_abc'));
    mockUnshare.mockResolvedValueOnce(netFail);
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());

    actionSheetSpy.mockImplementationOnce((_opts, cb: (i: number) => void) => cb(1));
    fireEvent(getButton(), 'longPress');
    fireEvent.press(await screen.findByText('share.revokeConfirm'));

    await waitFor(() => expect(mockUnshare).toHaveBeenCalledWith('p1'));
    const errorCall = alertSpy.mock.calls.find((c) => c[0] === 'share.errorTitle');
    expect(errorCall).toBeTruthy();
    const buttons = errorCall![2] as Array<{ text: string; onPress?: () => void }>;
    expect(buttons.some((b) => b.text === 'common.tryAgain')).toBe(true);
    expect(mockTrack).not.toHaveBeenCalledWith({ event: 'plan_share_revoked' });

    // The retry button actually re-fires the DELETE.
    mockUnshare.mockResolvedValueOnce({ data: null, error: null, errorBody: null, status: 204 });
    await act(async () => {
      buttons.find((b) => b.text === 'common.tryAgain')!.onPress!();
    });
    expect(mockUnshare).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenCalledWith({ event: 'plan_share_revoked' });
  });

  it('(e) network error ⇒ retriable alert, no share sheet, no crash', async () => {
    mockSharePlan.mockResolvedValueOnce(netFail);
    render(<ShareButton planId="p1" />);
    fireEvent.press(getButton());
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0];
    expect(title).toBe('share.errorTitle');
    expect(body).toBe('share.errorBody');
    expect(shareSpy).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('(f) share i18n keys exist and match across en/es', () => {
    const enKeys = Object.keys(en.share).sort();
    const esKeys = Object.keys(es.share).sort();
    expect(esKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
