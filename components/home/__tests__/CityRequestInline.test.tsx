/**
 * Behavioural tests for the shared "request your city" inline input. Covers the
 * reveal, the client-side validation that never touches the network, the two
 * success statuses (201 created / 200 dedup) with the analytics event, and the
 * server-error mapping (400 city_invalid, 429 rate limit). i18n parity for the
 * `cityRequest` block is asserted against the real resources.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CityRequestInline } from '../CityRequestInline';
import { requestCity } from '../../../lib/api';
import { track } from '../../../lib/analytics';
import en from '../../../lib/i18n/en';
import es from '../../../lib/i18n/es';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock('../../../lib/api', () => ({ requestCity: jest.fn() }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));

const mockRequestCity = requestCity as jest.Mock;
const mockTrack = track as jest.Mock;

const ok = (status: number) => ({ data: { message: 'ok' }, error: null, errorBody: null, status });
const fail = (status: number, error: string) => ({
  data: null,
  error,
  errorBody: { error },
  status,
});

beforeEach(() => jest.clearAllMocks());

function reveal() {
  fireEvent.press(screen.getByText('cityRequest.prompt'));
  return screen.getByPlaceholderText('cityRequest.placeholder');
}

describe('CityRequestInline', () => {
  it('(a) reveals the input when the prompt is tapped', () => {
    render(<CityRequestInline source="home" variant="dark" />);
    expect(screen.queryByPlaceholderText('cityRequest.placeholder')).toBeNull();
    const input = reveal();
    expect(input).toBeTruthy();
  });

  it('(a) uses the provided promptLabel over the default', () => {
    render(<CityRequestInline source="onboarding" variant="light" promptLabel="custom.prompt" />);
    expect(screen.getByText('custom.prompt')).toBeTruthy();
  });

  it('(b) empty input keeps submit disabled and never calls the API', () => {
    render(<CityRequestInline source="home" variant="dark" />);
    reveal();
    fireEvent.press(screen.getByText('cityRequest.submit'));
    expect(mockRequestCity).not.toHaveBeenCalled();
  });

  it('(b) a name over 100 chars errors client-side without calling the API', () => {
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'a'.repeat(101));
    fireEvent.press(screen.getByText('cityRequest.submit'));
    expect(screen.getByText('cityRequest.tooLong')).toBeTruthy();
    expect(mockRequestCity).not.toHaveBeenCalled();
  });

  it('(b) invalid characters error client-side without calling the API', () => {
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Miami 123');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    expect(screen.getByText('cityRequest.invalid')).toBeTruthy();
    expect(mockRequestCity).not.toHaveBeenCalled();
  });

  it('(b) accepts unicode letters, spaces, apostrophe, hyphen and dot', async () => {
    mockRequestCity.mockResolvedValueOnce(ok(201));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, "L'Hospitalet de Llobregat");
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(mockRequestCity).toHaveBeenCalledWith("L'Hospitalet de Llobregat"));
  });

  it('(c) success (201) shows the ack and tracks with source=home', async () => {
    mockRequestCity.mockResolvedValueOnce(ok(201));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Kyoto');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.thanks')).toBeTruthy());
    expect(mockTrack).toHaveBeenCalledWith({ event: 'city_request_submitted', source: 'home' });
    // Input is gone once acknowledged.
    expect(screen.queryByPlaceholderText('cityRequest.placeholder')).toBeNull();
  });

  it('(c) tracks source=onboarding on the onboarding surface', async () => {
    mockRequestCity.mockResolvedValueOnce(ok(201));
    render(<CityRequestInline source="onboarding" variant="light" ackLabel="custom.thanks" />);
    fireEvent.press(screen.getByText('cityRequest.prompt'));
    fireEvent.changeText(screen.getByPlaceholderText('cityRequest.placeholder'), 'Oslo');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('custom.thanks')).toBeTruthy());
    expect(mockTrack).toHaveBeenCalledWith({ event: 'city_request_submitted', source: 'onboarding' });
  });

  it('a same-frame double submit calls the API and track only once (in-flight latch)', async () => {
    mockRequestCity.mockResolvedValue(ok(201));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Kyoto');
    // Two synchronous submits from the SAME render closure: `canSubmit` reads a
    // stale `status`, so without the inFlightRef latch both would pass the guard
    // and fire requestCity + track twice. (fireEvent.press twice wouldn't cover
    // this: it flushes the re-render between taps and the button disables.)
    await act(async () => {
      input.props.onSubmitEditing();
      input.props.onSubmitEditing();
    });
    expect(mockRequestCity).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('cityRequest.thanks')).toBeTruthy();
  });

  it('(d) dedup (200) shows the same ack', async () => {
    mockRequestCity.mockResolvedValueOnce(ok(200));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Kyoto');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.thanks')).toBeTruthy());
    expect(mockTrack).toHaveBeenCalledWith({ event: 'city_request_submitted', source: 'home' });
  });

  it('(e) 400 city_invalid from the server shows the invalid message, no ack', async () => {
    mockRequestCity.mockResolvedValueOnce(fail(400, 'city_invalid'));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    // A name that passes the client regex but the server rejects.
    fireEvent.changeText(input, 'Neverland');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.invalid')).toBeTruthy());
    expect(mockTrack).not.toHaveBeenCalled();
    expect(screen.queryByText('cityRequest.thanks')).toBeNull();
  });

  it('(e) 400 city_too_long from the server maps to the too-long message', async () => {
    mockRequestCity.mockResolvedValueOnce(fail(400, 'city_too_long'));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Barcelona');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.tooLong')).toBeTruthy());
  });

  it('(f) 429 shows the rate-limit message', async () => {
    mockRequestCity.mockResolvedValueOnce(fail(429, 'rate_limited'));
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Barcelona');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.rateLimited')).toBeTruthy());
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('a network failure shows the generic retriable message', async () => {
    mockRequestCity.mockResolvedValueOnce({ data: null, error: 'Network error', errorBody: null, status: 0 });
    render(<CityRequestInline source="home" variant="dark" />);
    const input = reveal();
    fireEvent.changeText(input, 'Barcelona');
    fireEvent.press(screen.getByText('cityRequest.submit'));
    await waitFor(() => expect(screen.getByText('cityRequest.error')).toBeTruthy());
  });

  it('(g) cityRequest i18n keys exist and match across en/es', () => {
    const enKeys = Object.keys(en.cityRequest).sort();
    const esKeys = Object.keys(es.cityRequest).sort();
    expect(esKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
