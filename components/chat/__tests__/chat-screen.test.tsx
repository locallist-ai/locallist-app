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
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import ChatScreen from '../../../app/chat/index';
import { chatTurn, chatGenerate, getAccessToken } from '../../../lib/api';
import { track } from '../../../lib/analytics';
import { getSavedSessionId, saveSessionId } from '../../../lib/chat-store';
import { useTripContext } from '../../../lib/trip-context-store';
import { useAuth } from '../../../lib/auth';
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
  // Generación es [Authorize]: por defecto autenticado para los tests que
  // llegan a generar. Los tests de guest lo sobreescriben (token null).
  useAuth: jest.fn(() => ({
    isAuthenticated: true, isPro: false, aiPlansMonth: null, refreshAiPlansQuota: jest.fn(),
  })),
}));
jest.mock('../../../lib/trip-context-store', () => ({
  useTripContext: jest.fn(),
}));
jest.mock('../../../lib/api', () => ({
  chatTurn: jest.fn(),
  chatGenerate: jest.fn(),
  deleteChatSession: jest.fn(),
  upsertProfile: jest.fn(),
  getAccessToken: jest.fn(),
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
const mockUseAuth = useAuth as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;

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
  // Default: autenticado con token. Los tests de guest lo sobreescriben. Se fija
  // en beforeEach porque clearAllMocks no restaura implementaciones de mockReturnValue.
  mockUseAuth.mockReturnValue({
    isAuthenticated: true, isPro: false, aiPlansMonth: null, refreshAiPlansQuota: jest.fn(),
  });
  mockGetAccessToken.mockResolvedValue('valid-token');
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

describe('chat — guard de doble-tap en el CTA de generación', () => {
  it('dos taps en el mismo batch disparan un único chatGenerate', async () => {
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Listo para generar tu plan.', ready: true, quickReplies: [] }),
    );
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('chat.buildPlan')).toBeTruthy());

    let resolveGenerate!: (v: unknown) => void;
    (chatGenerate as jest.Mock).mockImplementationOnce(
      () => new Promise((res) => { resolveGenerate = res; }),
    );

    // Ruta CARA (rate limit 5/hr): un doble-tap síncrono no puede generar
    // dos planes. Mismo patrón que el guard de chips: ambos presses en el
    // mismo act(), closures stale con generating=false.
    const cta = screen.getByText('chat.buildPlan');
    await act(async () => {
      fireEvent.press(cta);
      fireEvent.press(cta);
    });

    expect(chatGenerate).toHaveBeenCalledTimes(1);
    expect(chatGenerate).toHaveBeenCalledWith({ sessionId: 's1' });

    await act(async () => {
      resolveGenerate({ data: { plan: { id: 'p1' } }, error: null, errorBody: null, status: 200 });
    });
    // Un solo plan generado → una sola navegación
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/plan/p1');
    expect(chatGenerate).toHaveBeenCalledTimes(1);
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

describe('chat — ciudad no cubierta (coverage gate)', () => {
  it('preSeeded con cityUnsupported renderiza aviso con CTA que va al selector', async () => {
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({
        aiMessage: 'Todavía no cubrimos Madrid. Prueba con Miami.',
        cityUnsupported: true,
        slots: { ...SLOTS, city: null },
        quickReplies: [{ id: 'qr-2d', label: '2 días' }],
      }),
    );
    render(<ChatScreen />);

    await waitFor(() =>
      expect(screen.getByText('Todavía no cubrimos Madrid. Prueba con Miami.')).toBeTruthy(),
    );
    // Se pinta como aviso (título + CTA), NO como turno normal con chips.
    expect(screen.getByText('chat.cityUnsupportedTitle')).toBeTruthy();
    expect(screen.queryByText('2 días')).toBeNull();

    fireEvent.press(screen.getByText('chat.cityUnsupportedCta'));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/home');
    // Analytics: reporta la ciudad que pidió el usuario (preseed), no null.
    expect(track).toHaveBeenCalledWith({
      event: 'chat_city_unsupported',
      sessionId: 's1',
      city: 'Madrid',
    });
  });

  it('un turno con cityUnsupported borra los chips y no muestra el CTA de generar', async () => {
    await renderPreSeeded();

    mockChatTurn.mockResolvedValueOnce(
      turnOk({
        aiMessage: 'No cubrimos Tokio todavía.',
        cityUnsupported: true,
        slots: { ...SLOTS, city: null },
        // El backend podría devolver chips; el aviso NO debe mostrarlos.
        quickReplies: [{ id: 'x', label: 'no-deberia-verse' }],
      }),
    );

    const input = screen.getByPlaceholderText('chat.inputPlaceholder');
    fireEvent.changeText(input, 'Tokio');
    fireEvent.press(screen.getByTestId('chat-send-btn'));

    await waitFor(() => expect(screen.getByText('No cubrimos Tokio todavía.')).toBeTruthy());
    expect(screen.getByText('chat.cityUnsupportedCta')).toBeTruthy();
    expect(screen.queryByText('no-deberia-verse')).toBeNull();
    expect(screen.queryByText('chat.buildPlan')).toBeNull();
    // Analytics: la ciudad real es lo que escribió el usuario en el turno.
    expect(track).toHaveBeenCalledWith({
      event: 'chat_city_unsupported',
      sessionId: 's1',
      city: 'Tokio',
    });
  });

  it('chatGenerate 400 city_unsupported muestra aviso amable, sin navegar a un plan', async () => {
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Listo para generar.', ready: true, quickReplies: [] }),
    );
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('chat.buildPlan')).toBeTruthy());

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: 'city_unsupported',
      errorBody: { error: 'city_unsupported', message: 'no cubierta', city: 'Madrid', liveCities: ['Miami'] },
      status: 400,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy).toHaveBeenCalledWith(
      'chat.cityUnsupportedTitle',
      'chat.cityUnsupportedBody',
      expect.any(Array),
    );
    // No se generó plan → no hay navegación a /plan/...
    expect(router.push).not.toHaveBeenCalled();
    // Analytics: usa la ciudad reportada por el 400 (`errorBody.city`), no null.
    expect(track).toHaveBeenCalledWith({
      event: 'chat_city_unsupported',
      sessionId: 's1',
      city: 'Madrid',
    });
    alertSpy.mockRestore();
  });
});

describe('chat — error de infraestructura (ai_unavailable)', () => {
  it('un turno con error ai_unavailable se pinta como error con reintento, no turno normal', async () => {
    await renderPreSeeded();

    mockChatTurn.mockResolvedValueOnce(
      turnOk({
        aiMessage: 'Estamos teniendo problemas. Inténtalo de nuevo.',
        error: 'ai_unavailable',
        quickReplies: [],
      }),
    );
    const input = screen.getByPlaceholderText('chat.inputPlaceholder');
    fireEvent.changeText(input, 'algo');
    fireEvent.press(screen.getByTestId('chat-send-btn'));

    await waitFor(() =>
      expect(screen.getByText('Estamos teniendo problemas. Inténtalo de nuevo.')).toBeTruthy(),
    );
    // Se pinta como error (título + reintento), NO como turno normal.
    expect(screen.getByText('chat.aiUnavailableTitle')).toBeTruthy();
    expect(screen.getByText('chat.aiUnavailableRetry')).toBeTruthy();
    expect(track).toHaveBeenCalledWith({ event: 'chat_ai_unavailable', sessionId: 's1' });

    // Reintento: reenvía el MISMO turno; en éxito muestra respuesta normal y
    // desaparece el estado de error.
    mockChatTurn.mockResolvedValueOnce(turnOk({ aiMessage: 'Perfecto, sigamos.', quickReplies: [] }));
    fireEvent.press(screen.getByText('chat.aiUnavailableRetry'));

    await waitFor(() => expect(screen.getByText('Perfecto, sigamos.')).toBeTruthy());
    expect(screen.queryByText('chat.aiUnavailableTitle')).toBeNull();
    expect(mockChatTurn).toHaveBeenLastCalledWith({
      sessionId: 's1',
      message: 'algo',
      quickReplyId: null,
    });
  });

  it('error ai_unavailable en el turno preseed inicial reintenta reusando la sesión creada, no la recrea', async () => {
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Miami' });
    // El turno preseed fallido ya trae sessionId (s1): el backend creó la
    // sesión aunque la cadena LLM cayera.
    mockChatTurn.mockResolvedValueOnce(
      turnOk({
        sessionId: 's1',
        aiMessage: 'No podemos procesar ahora mismo.',
        error: 'ai_unavailable',
        quickReplies: [],
      }),
    );
    render(<ChatScreen />);

    await waitFor(() => expect(screen.getByText('No podemos procesar ahora mismo.')).toBeTruthy());
    expect(screen.getByText('chat.aiUnavailableTitle')).toBeTruthy();
    // El primer intento sí manda sessionId:null (crea la sesión).
    expect(mockChatTurn).toHaveBeenNthCalledWith(1, {
      sessionId: null,
      message: '',
      quickReplyId: null,
      preSeededSlots: { city: 'Miami' },
    });

    mockChatTurn.mockResolvedValueOnce(
      turnOk({ sessionId: 's1', aiMessage: 'Hola, ¿cuántos días en Miami?', quickReplies: [] }),
    );
    fireEvent.press(screen.getByText('chat.aiUnavailableRetry'));

    await waitFor(() => expect(screen.getByText('Hola, ¿cuántos días en Miami?')).toBeTruthy());
    expect(screen.queryByText('chat.aiUnavailableTitle')).toBeNull();
    // Clave del fix (gemelo del camino de texto libre): el reintento reusa la
    // sesión que el turno preseed fallido ya creó (s1), no manda sessionId:null
    // —que crearía una 2ª sesión huérfana—, y reenvía el mismo preSeededSlots.
    expect(mockChatTurn).toHaveBeenLastCalledWith({
      sessionId: 's1',
      message: '',
      quickReplyId: null,
      preSeededSlots: { city: 'Miami' },
    });
  });

  it('reintento de un ai_unavailable en el PRIMER turno reusa la sesión creada, no la recrea', async () => {
    // Sin sesión previa ni ciudad pre-seleccionada: el primer turno es texto libre.
    // El backend crea la sesión (s1) pero la cadena cae → ai_unavailable. El
    // reintento debe reusar s1 (no mandar sessionId:null, que crearía una 2ª sesión).
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: null });
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('chat.welcomeMessage')).toBeTruthy());

    mockChatTurn.mockResolvedValueOnce(
      turnOk({ sessionId: 's1', aiMessage: 'No puedo ahora mismo.', error: 'ai_unavailable', quickReplies: [] }),
    );
    fireEvent.changeText(screen.getByPlaceholderText('chat.inputPlaceholder'), 'restaurantes');
    fireEvent.press(screen.getByTestId('chat-send-btn'));

    await waitFor(() => expect(screen.getByText('chat.aiUnavailableTitle')).toBeTruthy());
    // El primer turno se envió sin sesión.
    expect(mockChatTurn).toHaveBeenNthCalledWith(1, { sessionId: null, message: 'restaurantes', quickReplyId: null });

    mockChatTurn.mockResolvedValueOnce(turnOk({ sessionId: 's1', aiMessage: 'Listo, sigamos.', quickReplies: [] }));
    fireEvent.press(screen.getByText('chat.aiUnavailableRetry'));

    await waitFor(() => expect(screen.getByText('Listo, sigamos.')).toBeTruthy());
    // Clave del fix: el reintento reusa s1, no recrea sesión con sessionId:null.
    expect(mockChatTurn).toHaveBeenLastCalledWith({ sessionId: 's1', message: 'restaurantes', quickReplyId: null });
  });
});

describe('chat — gate Plus en generación', () => {
  // Lleva el chat a estado ready y devuelve el spy de Alert. `authed` controla
  // la PRESENCIA DE TOKEN (G1): guest real = sin token → CTA de registro.
  const arriveReady = async (authed = true) => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: authed, isPro: false, aiPlansMonth: null, refreshAiPlansQuota: jest.fn(),
    });
    mockGetAccessToken.mockResolvedValue(authed ? 'valid-token' : null);
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Listo para generar tu plan.', ready: true, quickReplies: [] }),
    );
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('chat.buildPlan')).toBeTruthy());
    return jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  };

  it('guest: tocar generar muestra CTA de registro y NO llama a chatGenerate', async () => {
    const alertSpy = await arriveReady(false);

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'gate.signupRequiredTitle',
        'gate.signupRequiredBody',
        expect.any(Array),
      ),
    );
    expect(chatGenerate).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('G1: token presente pero user null (auto-login falló) → genera, NO signup', async () => {
    // Blip transitorio de /account: isAuthenticated=false pero el token vive en
    // SecureStore. El gate por presencia de token deja pasar la generación.
    mockUseAuth.mockReturnValue({
      isAuthenticated: false, isPro: false, aiPlansMonth: null, refreshAiPlansQuota: jest.fn(),
    });
    mockGetAccessToken.mockResolvedValue('valid-token');
    mockGetSavedSessionId.mockResolvedValue(null);
    mockUseTripContext.mockReturnValue({ city: 'Madrid' });
    mockChatTurn.mockResolvedValueOnce(
      turnOk({ aiMessage: 'Listo para generar tu plan.', ready: true, quickReplies: [] }),
    );
    render(<ChatScreen />);
    await waitFor(() => expect(screen.getByText('chat.buildPlan')).toBeTruthy());
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: { plan: { id: 'p1', durationDays: 2 } }, error: null, errorBody: null, status: 200,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(chatGenerate).toHaveBeenCalled());
    expect(alertSpy).not.toHaveBeenCalledWith('gate.signupRequiredTitle', expect.anything(), expect.anything());
    alertSpy.mockRestore();
  });

  it('401 en generación → CTA de registro', async () => {
    const alertSpy = await arriveReady(true);
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null, error: 'unauthorized', errorBody: { error: 'unauthorized' }, status: 401,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'gate.signupRequiredTitle', 'gate.signupRequiredBody', expect.any(Array),
    ));
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining('/plan/'));
    alertSpy.mockRestore();
  });

  it('403 plan_limit_reached → upsell de límite de planes', async () => {
    const alertSpy = await arriveReady(true);
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null, error: 'plan_limit_reached',
      errorBody: { error: 'plan_limit_reached', used: 3, limit: 3, resetsAt: '2026-08-01T00:00:00Z' },
      status: 403,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'gate.planLimitTitle', expect.any(String), expect.any(Array),
    ));
    alertSpy.mockRestore();
  });

  it('403 duration_requires_plus → upsell de duración', async () => {
    const alertSpy = await arriveReady(true);
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null, error: 'duration_requires_plus',
      errorBody: { error: 'duration_requires_plus', maxDays: 3, plusMaxDays: 14 },
      status: 403,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'gate.durationTitle', expect.any(String), expect.any(Array),
    ));
    alertSpy.mockRestore();
  });

  it('429 daily_cap_reached → throttling suave (Plus), NO rate-limit genérico', async () => {
    const alertSpy = await arriveReady(true);
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null, error: 'daily_cap_reached',
      errorBody: { error: 'daily_cap_reached' }, status: 429,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'gate.dailyCapTitle', expect.any(String), expect.any(Array),
    ));
    // No debe caer en el copy de rate-limit genérico del chat.
    expect(alertSpy).not.toHaveBeenCalledWith('chat.rateLimitTitle', expect.anything(), expect.anything());
    alertSpy.mockRestore();
  });

  it('429 genérico (sin código gate) → rate-limit del chat', async () => {
    const alertSpy = await arriveReady(true);
    (chatGenerate as jest.Mock).mockResolvedValueOnce({
      data: null, error: 'too_many', errorBody: { error: 'too_many' }, status: 429,
    });

    fireEvent.press(screen.getByText('chat.buildPlan'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('chat.rateLimitTitle', 'chat.rateLimitBody'));
    alertSpy.mockRestore();
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
