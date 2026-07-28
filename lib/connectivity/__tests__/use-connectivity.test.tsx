/**
 * Contrato del hook de conectividad:
 *  - `computeIsOffline`: `isConnected===false` o `isInternetReachable===false` =>
 *    offline; null/undefined (DESCONOCIDO) NUNCA es offline (asumimos online).
 *  - `useConnectivity` refleja el estado emitido por `NetInfo.addEventListener`.
 *  - Limpia la suscripción en unmount.
 *  - `onReconnect` se dispara SOLO en la transición offline -> online: ni en el
 *    primer evento online del arranque, ni en cada cambio de estado.
 *
 * netinfo se mockea vía `../netinfo-module` (require-guard); los tests empujan
 * estados a través del listener capturado.
 */
import { renderHook, act } from '@testing-library/react-native';
import { computeIsOffline, useConnectivity } from '../use-connectivity';

type Listener = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;

jest.mock('../netinfo-module', () => {
  const listeners: Listener[] = [];
  const unsubscribe = jest.fn();
  const netInfo = {
    addEventListener: jest.fn((cb: Listener) => {
      listeners.push(cb);
      return unsubscribe;
    }),
  };
  return {
    getNetInfoModule: jest.fn(() => netInfo),
    __listeners: listeners,
    __unsubscribe: unsubscribe,
    __addEventListener: netInfo.addEventListener,
  };
});

const mod = jest.requireMock('../netinfo-module') as {
  __listeners: Listener[];
  __unsubscribe: jest.Mock;
  __addEventListener: jest.Mock;
  getNetInfoModule: jest.Mock;
};

/** Empuja un estado por todos los listeners suscritos, dentro de act. */
function emit(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  act(() => {
    mod.__listeners.forEach((l) => l(state));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mod.__listeners.length = 0;
});

describe('computeIsOffline', () => {
  it('offline solo cuando isConnected===false o isInternetReachable===false', () => {
    expect(computeIsOffline({ isConnected: false, isInternetReachable: false })).toBe(true);
    expect(computeIsOffline({ isConnected: true, isInternetReachable: false })).toBe(true);
    expect(computeIsOffline({ isConnected: false, isInternetReachable: true })).toBe(true);
    expect(computeIsOffline({ isConnected: true, isInternetReachable: true })).toBe(false);
  });

  it('DESCONOCIDO (null / undefined / sin estado) nunca es offline', () => {
    expect(computeIsOffline({ isConnected: true, isInternetReachable: null })).toBe(false);
    expect(computeIsOffline({ isConnected: null, isInternetReachable: null })).toBe(false);
    expect(computeIsOffline(null)).toBe(false);
    expect(computeIsOffline(undefined)).toBe(false);
  });
});

describe('useConnectivity', () => {
  it('arranca en online y refleja online/offline emitidos por netinfo', () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.isOffline).toBe(false);

    emit({ isConnected: false, isInternetReachable: false });
    expect(result.current.isOffline).toBe(true);

    emit({ isConnected: true, isInternetReachable: true });
    expect(result.current.isOffline).toBe(false);
  });

  it('red conectada sin salida a internet (isInternetReachable false) es offline', () => {
    const { result } = renderHook(() => useConnectivity());
    emit({ isConnected: true, isInternetReachable: false });
    expect(result.current.isOffline).toBe(true);
  });

  it('estado DESCONOCIDO (isInternetReachable null) NO marca offline', () => {
    const { result } = renderHook(() => useConnectivity());
    emit({ isConnected: true, isInternetReachable: null });
    expect(result.current.isOffline).toBe(false);
  });

  it('limpia la suscripción en unmount', () => {
    const { unmount } = renderHook(() => useConnectivity());
    expect(mod.__addEventListener).toHaveBeenCalledTimes(1);
    expect(mod.__unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mod.__unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('onReconnect se dispara SOLO en la transición offline -> online', () => {
    const onReconnect = jest.fn();
    renderHook(() => useConnectivity({ onReconnect }));

    // Primer evento online del arranque: NO cuenta como reconexión.
    emit({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).not.toHaveBeenCalled();

    // online -> online: sin transición.
    emit({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).not.toHaveBeenCalled();

    // online -> offline: no es reconexión.
    emit({ isConnected: false, isInternetReachable: false });
    expect(onReconnect).not.toHaveBeenCalled();

    // offline -> online: AQUÍ y solo aquí.
    emit({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // online -> online otra vez: no vuelve a dispararse.
    emit({ isConnected: true, isInternetReachable: true });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('sin módulo nativo (require-guard null) no suscribe y se queda online', () => {
    mod.getNetInfoModule.mockReturnValueOnce(null);
    const onReconnect = jest.fn();
    const { result } = renderHook(() => useConnectivity({ onReconnect }));
    expect(result.current.isOffline).toBe(false);
    expect(mod.__addEventListener).not.toHaveBeenCalled();
    expect(onReconnect).not.toHaveBeenCalled();
  });

  // Regresión del crash que bloqueaba las pruebas de Pablo: en un binario
  // pre-rebuild el módulo JS resuelve (getNetInfoModule NO devuelve null) pero
  // `addEventListener` LANZA al invocarse porque el módulo nativo `RNCNetInfo`
  // es null. El hook debe CONTENER ese throw: quedarse online, sin propagar.
  it('addEventListener que LANZA (módulo nativo null) no crashea: online permanente', () => {
    const brokenNetInfo = {
      addEventListener: jest.fn(() => {
        throw new Error("Cannot read property 'addEventListener' of null (RNCNetInfo)");
      }),
    };
    mod.getNetInfoModule.mockReturnValueOnce(brokenNetInfo);
    const onReconnect = jest.fn();

    let result: { current: { isOffline: boolean } } | undefined;
    let unmount: (() => void) | undefined;
    expect(() => {
      const hook = renderHook(() => useConnectivity({ onReconnect }));
      result = hook.result;
      unmount = hook.unmount;
    }).not.toThrow();

    expect(result?.current.isOffline).toBe(false); // el crash que veía Pablo, ahora contenido.
    expect(brokenNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(onReconnect).not.toHaveBeenCalled();

    // El teardown tampoco puede lanzar aunque no haya suscripción viva.
    expect(() => unmount?.()).not.toThrow();
  });

  it('unsubscribe que LANZA en el teardown no propaga en unmount', () => {
    const throwingUnsubscribe = jest.fn(() => {
      throw new Error('unsubscribe against null native module');
    });
    const flakyNetInfo = {
      addEventListener: jest.fn(() => throwingUnsubscribe),
    };
    mod.getNetInfoModule.mockReturnValueOnce(flakyNetInfo);

    const { unmount } = renderHook(() => useConnectivity());
    expect(flakyNetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
    expect(throwingUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
