/**
 * Tests de comportamiento del chat conversacional (`app/chat/index.tsx`) —
 * flujo PRIMARIO de creación de planes desde PR #50.
 *
 * Cubre:
 *  - preSeededCity: el init dispara chatTurn UNA sola vez (initRef) con
 *    preSeededSlots y la respuesta llega a la lista de mensajes.
 *  - Guard de doble-tap en QuickReplyChips: un doble-tap no dispara un
 *    segundo chatTurn ni duplica el bubble del usuario.
 *  - Retry path del PR #61: en error transitorio (429) los quick replies
 *    anteriores se restauran y se muestra el mensaje de rate limit.
 *
 * chatTurn se mockea (error-as-value, mismo shape que lib/api). Nada de
 * snapshots: solo aserciones de comportamiento observable.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ChatScreen from '../../../app/chat/index';
import { chatTurn } from '../../../lib/api';
import { getSavedSessionId, saveSessionId } from '../../../lib/chat-store';
import { useTripContext } from '../../../lib/trip-context-store';
import type { ChatSlots, ChatTurnResponse } from '../../../lib/types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurView: View };
});
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../lib/auth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
jest.mock('../../../lib/trip-context-store', () => ({
  useTripContext: jest.fn(),
}));
jest.mock('../../../lib/api', () => ({
  chatTurn: jest.fn(),
  chatGenerate: jest.fn(),
  deleteChatSession: jest.fn(),
  upsertProfile: jest.fn(),
}));
jest.mock('../../../lib/chat-store', () => ({
  getSavedSessionId: jest.fn(),
  saveSessionId: jest.fn(),
  clearSessionId: jest.fn(),
}));
jest.mock('../../../lib/analytics', () => ({
  track: jest.fn(),
  countFilledSlots: jest.fn(() => 0),
}));
jest.mock('../../home/TypingDots', () => ({ TypingDots: () => null }));
jest.mock('../SaveProfileSheet', () => ({ SaveProfileSheet: () => null }));
jest.mock('../../ui/ConfirmModal', () => ({ ConfirmModal: () => null }));

const mockChatTurn = chatTurn as jest.Mock;
const mockGetSavedSessionId = getSavedSessionId as jest.Mock;
const mockUseTripContext = useTripContext as jest.Mock;

const SLOTS: ChatSlots = {
  city: 'Madrid',
  days: null,
  groupType: null,
  categories: null,
  budget: null,
  pace: null,
  dietary: null,
  exclusions: null,
  vibesPrimary: null,
};

const turnOk = (over: Partial<ChatTurnResponse> = {}) => ({
  data: {
    sessionId: 's1',
    aiMessage: '¿Cuántos días te quedas en Madrid?',
    slots: SLOTS,
    missingCritical: ['days'],
    quickReplies: [
      { id: 'qr-2d', label: '2 días' },
      { id: 'qr-solo', label: 'Viajo solo' },
    ],
    ready: false,
    turnCount: 1,
    turnLimit: 12,
    ...over,
  },
  error: null,
  errorBody: null,
  status: 200,
});

// Init estándar: sin sesión previa, ciudad pre-seleccionada → el primer
// chatTurn (preSeeded) devuelve saludo + chips.
const renderPreSeeded = async () => {
  mockGetSavedSessionId.mockResolvedValue(null);
  mockUseTripContext.mockReturnValue({ city: 'Madrid' });
  mockChatTurn.mockResolvedValueOnce(turnOk());
  const result = render(<ChatScreen />);
  await waitFor(() => expect(screen.getByText('¿Cuántos días te quedas en Madrid?')).toBeTruthy());
  return result;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('chat — init con preSeededCity', () => {
  it('dispara chatTurn una sola vez con preSeededSlots y muestra la respuesta', async () => {
    const { rerender } = await renderPreSeeded();

    expect(mockChatTurn).toHaveBeenCalledTimes(1);
    expect(mockChatTurn).toHaveBeenCalledWith({
      sessionId: null,
      message: '',
      quickReplyId: null,
      preSeededSlots: { city: 'Madrid' },
    });
    expect(saveSessionId).toHaveBeenCalledWith('s1');
    // Los quick replies de la respuesta se renderizan
    expect(screen.getByText('2 días')).toBeTruthy();
    expect(screen.getByText('Viajo solo')).toBeTruthy();

    // initRef: un re-render no re-dispara el turn de init
    rerender(<ChatScreen />);
    expect(mockChatTurn).toHaveBeenCalledTimes(1);
  });

  it('con sesión guardada NO llama a chatTurn y muestra el welcome', async () => {
    mockGetSavedSessionId.mockResolvedValue('sess-previa');
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    render(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('chat.welcomeMessage')).toBeTruthy());
    expect(mockChatTurn).not.toHaveBeenCalled();
  });
});

describe('chat — guard de doble-tap en QuickReplyChips', () => {
  it('dos taps en el mismo batch disparan un único chatTurn y un único bubble', async () => {
    await renderPreSeeded();

    let resolveTurn!: (v: unknown) => void;
    mockChatTurn.mockImplementationOnce(
      () => new Promise((res) => { resolveTurn = res; }),
    );

    // Doble-tap verdaderamente síncrono: ambos presses dentro del MISMO
    // act(), sin flush entre medias — el chip sigue montado y ambos handlers
    // ven loading=false (closure stale). Solo el guard síncrono de
    // pendingRef puede parar el segundo. Un press-2 tras desmontar el chip
    // (test anterior) era un falso positivo.
    const chip = screen.getByText('2 días');
    await act(async () => {
      fireEvent.press(chip);
      fireEvent.press(chip);
    });

    // init (1) + primer tap (1) = 2. El doble-tap no suma.
    expect(mockChatTurn).toHaveBeenCalledTimes(2);
    expect(mockChatTurn).toHaveBeenLastCalledWith({
      sessionId: 's1',
      message: '2 días',
      quickReplyId: 'qr-2d',
    });
    // Un solo bubble del usuario con el label del chip (el chip ya no está)
    expect(screen.getAllByText('2 días')).toHaveLength(1);

    await act(async () => {
      resolveTurn(turnOk({ aiMessage: 'Perfecto, 2 días.', quickReplies: [], turnCount: 2 }));
    });
    expect(screen.getByText('Perfecto, 2 días.')).toBeTruthy();
    // Tras resolver, sigue habiendo un único bubble y ningún turn extra
    expect(mockChatTurn).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('2 días')).toHaveLength(1);
  });
});

describe('chat — input post-ready (#61)', () => {
  it('con ready=true el input sigue editable y el envío dispara otro turn', async () => {
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Listo para generar tu plan.', ready: true, quickReplies: [] }),
    );
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('Listo para generar tu plan.')).toBeTruthy());

    // CTA de generación visible y campo de texto activo (correcciones via MergeSlots)
    expect(screen.getByText('chat.buildPlan')).toBeTruthy();
    const input = screen.getByPlaceholderText('chat.inputPlaceholder');
    expect(input.props.editable).toBe(true);

    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Anotado, sin gluten.', ready: true, quickReplies: [], turnCount: 2 }),
    );
    fireEvent.changeText(input, 'sin gluten');
    fireEvent.press(screen.getByTestId('chat-send-btn'));

    await waitFor(() => expect(screen.getByText('Anotado, sin gluten.')).toBeTruthy());
    expect(mockChatTurn).toHaveBeenCalledTimes(2);
    expect(mockChatTurn).toHaveBeenLastCalledWith({
      sessionId: 's1',
      message: 'sin gluten',
      quickReplyId: null,
    });
    expect(screen.getByText('sin gluten')).toBeTruthy();
  });
});

describe('chat — restore de chips tras error transitorio (PR #61)', () => {
  it('tras un 429 restaura los quick replies anteriores y muestra rate-limited', async () => {
    await renderPreSeeded();

    mockChatTurn.mockResolvedValueOnce({
      data: null,
      error: 'Too many requests',
      errorBody: null,
      status: 429,
    });

    fireEvent.press(screen.getByText('2 días'));

    await waitFor(() => expect(screen.getByText('chat.rateLimited')).toBeTruthy());
    // Chips restaurados: '2 días' aparece como bubble del usuario Y como chip;
    // 'Viajo solo' solo como chip restaurado.
    expect(screen.getAllByText('2 días')).toHaveLength(2);
    expect(screen.getByText('Viajo solo')).toBeTruthy();
    // La sesión no cambió: no se guardó ningún sessionId nuevo
    expect(saveSessionId).toHaveBeenCalledTimes(1);
  });

  it('tras un error de red genérico también restaura los chips', async () => {
    await renderPreSeeded();

    mockChatTurn.mockResolvedValueOnce({
      data: null,
      error: 'Network request failed',
      errorBody: null,
      status: 0,
    });

    fireEvent.press(screen.getByText('Viajo solo'));

    await waitFor(() => expect(screen.getByText('chat.errorRetry')).toBeTruthy());
    expect(screen.getAllByText('Viajo solo')).toHaveLength(2);
    expect(screen.getByText('2 días')).toBeTruthy();
  });
});
