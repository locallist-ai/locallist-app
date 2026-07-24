/**
 * Integración con el ROUTER REAL (expo-router 6 + @react-navigation/routers
 * 7.5.3, sin mockear `expo-router`): semántica de stack del ida-vuelta
 * wizard ⇄ chat tras la inversión de jerarquía (wizard = flujo primario).
 *
 * Por qué existe: los unit tests de las pantallas mockean `expo-router` entero
 * y no pueden cazar la semántica real de NAVIGATE/POP_TO (la review adversarial
 * demostró que `navigate` re-PUSHea una ruta enterrada). Aquí se monta un stack
 * real vía `renderRouter` con pantallas stub que ejecutan EXACTAMENTE las
 * mismas llamadas que producción (opt-in: `router.push('/chat')`; escape:
 * `router.dismissTo('/builder/wizard')`) — que producción hace esas llamadas lo
 * assertan los unit tests de cada pantalla (DurationStep.test / chat-screen.test).
 *
 * Qué se asserta y qué no:
 *  - SE ASSERTA el estado del stack real (rutas + keys): N ida-vueltas nunca
 *    acumulan más de [wizard, chat] y la ruta del wizard CONSERVA SU KEY
 *    original tras cada POP_TO — es decir, el router pop-ea hasta la instancia
 *    existente, no crea una nueva (con `navigate` la key cambiaría por re-push).
 *  - NO se asserta la supervivencia del useState del componente: el mock de
 *    react-native-screens en jest desmonta las pantallas tapadas (artefacto del
 *    entorno). En dispositivo, native-stack mantiene montada la pantalla
 *    enterrada, así que key estable ⇒ misma instancia ⇒ respuestas conservadas.
 */

import React from 'react';
import { Text, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { renderRouter, screen, fireEvent, act } from 'expo-router/testing-library';
// Import privado, solo para leer el estado HIDRATADO del stack (con keys). El
// `getRouterState()` público devuelve el linking-state stale (sin keys ni type).
import { store } from 'expo-router/build/global-state/router-store';

function WizardStub() {
  return (
    <View>
      {/* Mismo call que DurationStep.handleOpenChat */}
      <Pressable testID="wizard-open-chat" onPress={() => router.push('/chat')}>
        <Text>chat</Text>
      </Pressable>
    </View>
  );
}

function ChatStub() {
  return (
    <View>
      {/* Mismo call que ChatScreen.handleUseWizard */}
      <Pressable testID="chat-escape" onPress={() => router.dismissTo('/builder/wizard')}>
        <Text>wizard</Text>
      </Pressable>
    </View>
  );
}

const routes = {
  index: () => <View testID="home-stub" />,
  'builder/wizard': WizardStub,
  'chat/index': ChatStub,
};

type RenderedApp = ReturnType<typeof renderRouter>;

type NavState = {
  type?: string;
  routes?: { name: string; key: string; state?: NavState }[];
};

/**
 * Rutas del stack raíz real: `[{ name, key }, ...]`. Se lee del estado
 * HIDRATADO (`store.navigationRef.getRootState()`, bajo el wrapper `__root`)
 * descendiendo hasta el primer navigator de tipo `stack`.
 */
function stackRoutes(_app: RenderedApp): { name: string; key: string }[] {
  let state: NavState | undefined = store.navigationRef.getRootState() as unknown as NavState;
  // El navigator raíz es un stack cuyo único hijo es el wrapper `__root`; el
  // stack de pantallas real vive un nivel por debajo.
  while (state && state.routes?.length === 1 && state.routes[0].name === '__root') {
    state = state.routes[0].state;
  }
  expect(state?.type).toBe('stack');
  return (state?.routes ?? []).map(({ name, key }) => ({ name, key }));
}

describe('stack real — ida-vuelta wizard ⇄ chat', () => {
  it('3 ida-vueltas: el wizard conserva su key (misma instancia) y el stack queda acotado', async () => {
    const app = renderRouter(routes, { initialUrl: '/builder/wizard' });
    await screen.findByTestId('wizard-open-chat');

    const initial = stackRoutes(app);
    expect(initial.map((r) => r.name)).toEqual(['builder/wizard']);
    const wizardKey = initial[0].key;

    for (let i = 0; i < 3; i++) {
      // Opt-in → push: chat ENCIMA del wizard, nunca más de 2 rutas.
      await act(async () => fireEvent.press(screen.getByTestId('wizard-open-chat')));
      expect(app.getPathname()).toBe('/chat');
      const withChat = stackRoutes(app);
      expect(withChat.map((r) => r.name)).toEqual(['builder/wizard', 'chat/index']);
      // El wizard enterrado sigue siendo LA MISMA ruta (key intacta).
      expect(withChat[0].key).toBe(wizardKey);

      // Escape → dismissTo (POP_TO): pop hasta el wizard EXISTENTE.
      await act(async () => fireEvent.press(screen.getByTestId('chat-escape')));
      expect(app.getPathname()).toBe('/builder/wizard');
      const afterEscape = stackRoutes(app);
      expect(afterEscape.map((r) => r.name)).toEqual(['builder/wizard']);
      // Clave del fix de la review: la key NO cambia — POP_TO reusó la
      // instancia. Con `navigate` (re-push de ruta enterrada) habría una key
      // nueva y el stack acumularía wizards.
      expect(afterEscape[0].key).toBe(wizardKey);
    }
  });

  it('deep-link a /chat sin wizard debajo: el escape navega al wizard sin crash ni residuo', async () => {
    const app = renderRouter(routes, { initialUrl: '/chat' });
    await screen.findByTestId('chat-escape');
    expect(stackRoutes(app).map((r) => r.name)).toEqual(['chat/index']);

    await act(async () => fireEvent.press(screen.getByTestId('chat-escape')));

    // StackRouter POP_TO, rama index === -1: sustituye la ruta actual por el
    // wizard. Navegación efectiva, sin chat residual apilado.
    expect(app.getPathname()).toBe('/builder/wizard');
    expect(stackRoutes(app).map((r) => r.name)).toEqual(['builder/wizard']);
  });
});
