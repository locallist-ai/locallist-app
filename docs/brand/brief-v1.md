# LocalList — Brand Brief v1

**Para**: Claude Design (Anthropic Labs) — input de contexto para diseño de identidad.
**Fecha**: 2026-04-22.
**Estado**: v1 inicial, iterar con feedback de Pablo.

---

## 1. Posicionamiento en una frase

LocalList es **el anti-Wanderlog**: en lugar de mostrar 40 restaurantes como lista infinita, te da **un plan curado listo para seguir**, editorial, con personalidad local. "Stop researching. Start traveling."

### Contexto competitivo

| Producto | Qué hace | Cómo nos diferenciamos |
|---|---|---|
| **Wanderlog** | Mapas + listas crowdsourced, UI cluttered | Nosotros: 1 plan, no 40 opciones. Tipografía tranquila, no mapa tiritando. |
| **TripIt** | Agregador de confirmations de vuelos/hoteles | Ortogonal — TripIt gestiona logística, LocalList gestiona experiencia. |
| **Google Maps** | Universal, neutro, pin-centric | Nosotros: pin NO es nuestra metáfora principal (hay que alejarse del pin por eso mismo). |

**Diferencial visual clave**: somos **simples y editoriales** (tipografía serif, aire tipo revista de viajes), no **utility tech** (apps grises con pins y listas). El logo debe SENTIRSE tranquilo, no gritar.

## 2. Voice (de la landing actual)

- **Hero headline**: "Stop researching. Start traveling."
- **Subheadline**: "No endless options. No tourist traps. Just a plan built to be followed."
- **Meta**: "LocalList helps you plan your trip in minutes and guides you step by step, even offline."

**Tono**: directo, imperativo benévolo, anti-frills. Promete alivio ("stop researching") y simpleza ("just a plan"). Nada aspiracional-vacío tipo "unlock adventures".

## 3. Experiencia del producto (lo que el logo debe reflejar)

LocalList es una app **muy sencilla, fácil de usar y amigable**. Decisiones de producto que lo demuestran:

- Flujo de onboarding de 3 pasos, no 10.
- **Emojis con animaciones** en micro-interacciones (tap CTA, plan generado, stop completado) — lenguaje visual cálido, no interfaz de Excel.
- Copy directo en imperativo benévolo: "Build your plan", "Start trip".
- Colores cálidos en lugar de los azules fríos tipo Google/Airbnb.
- Un solo plan cada vez, no 40 resultados de búsqueda que angustian.

El logo debe **sentirse coherente con esta experiencia**. Cuando un usuario ve el icon en su home screen, debe anticipar una app que NO le va a hacer trabajar. Transmisor principal: **confianza tranquila** ("esto va a ser fácil", "alguien humano lo pensó por mí").

## 4. Pilares visuales (3)

1. **Simple con personalidad** — el mark debe resolverse en 1 forma reconocible (legible a 16px) PERO con carácter propio que lo haga memorable. No queremos tipografía sola ni geometría plana sin alma. Queremos un **símbolo con significado doble** tipo Airbnb Bélo (corazón+ubicación+personas en una sola forma) o un **mark ilustrado amigable** tipo Wanderlog (pin antropomorfo con personalidad). La simplicidad es DE FORMA, no DE IDEA: la idea detrás del símbolo puede tener capas, pero el dibujo resultante se lee de un vistazo.
2. **Amigable** — curvas suaves sobre ángulos duros. Si el símbolo parece sonreír, sugerir movimiento, o insinuar un gesto humano, mejor. Evitar formas rígidas, severas, tipo logo de banco o bufete. El logo debe SENTIRSE como las animaciones de emojis dentro de la app.
3. **Cálido + confiable** — paleta Paper White (`#F2EFE9`) + Sunset Orange (`#f97316`) da sensación de papel tangible, hecho a mano, no interfaz digital fría. El logo debe transmitir "humano eligió esto por ti, puedes confiar" — no "AI algorithm procesando tu petición". Evitar azules corporativos tipo SaaS, evitar tipografía tech (mono, geometric grotesk duro).

## Referencias aspiracionales (IR a mirarlas antes de diseñar)

Logos que capturan el espíritu deseado — por motivos distintos:

- **Airbnb Bélo** — símbolo abstracto con significado múltiple (corazón + ubicación + personas), simple pero único.
- **Wanderlog** — pin estilizado con personalidad, amigable, no cae en "pin genérico".
- **Duolingo** (búho Duo) — friendly, animable, transmite confianza no-intimidante.
- **Strava** (S orgánica) — letra convertida en forma con movimiento.
- **Headspace** (punto con sonrisa implícita) — minimalismo cálido, no frío.

Logos que NO queremos — para calibrar:
- Pines genéricos tipo Google Maps / Foursquare / Yelp.
- Wordmarks editoriales tipo New York Times (demasiado serio).
- Geometric grotesk frío tipo Stripe / Vercel (demasiado tech).
- Íconos de apps de viaje clásicas tipo TripAdvisor (búho literal saturado).

## 5. Tokens existentes (byte-idénticos en app + admin + landing)

Claude Design los leerá automáticamente de `lib/theme.ts`, pero cito aquí para referencia rápida:

- Primary: `#3b82f6` (Electric Blue) — CTAs, links.
- Accent: `#f97316` (Sunset Orange) — highlights, confirmations.
- BG: `#F2EFE9` (Paper White) — canvas principal.
- Surface: `#FFFFFF` — cards.
- Text: `#1e293b` (Deep Ocean) + `#475569` (secondary).
- Success: `#10b981`, Error: `#ef4444`.
- **Fuentes**: Inter (body, 4 pesos) + Playfair Display (heading, 3 pesos).

**Nota**: el Primary Blue no es el "color de marca" sentimental — es utility. El alma cromática de LocalList es **Paper White + Sunset Orange**. El logo debería inclinar hacia ese pair.

## 6. Restricciones técnicas duras

- **Favicon 16×16 debe ser legible**. Si un concepto no pasa este test, queda descartado. Crítico porque compartimos browser tabs con Google Maps, Gmail, etc.
- **iOS icon 1024×1024** sin padding reservado (iOS añade su propio rounded rect mask).
- **Sin texto** dentro del mark del app icon (excepto monogram "L" o "LL" si se usa).
- **Contraste WCAG AA** sobre Paper White Y sobre dark futuro (preparar variant white).
- **Adaptive Android** — foreground con zona de seguridad al 66% del canvas (la máscara recorta los bordes).
- **Splash 2732×2732** (iPad Pro) escalable sin pérdida.

### Prohibiciones explícitas

- **NO naturaleza** — nada de montañas, nubes, sol, olas, palmeras, árboles, flora, fauna, paisajes. El mark actual falla por esto.
- **NO pins de mapa** — ni Google-Maps-style, ni Foursquare-style, ni ningún pin reinterpretado. Diferenciación de categoría obligatoria.
- **NO iconografía literal de viajes** — maleta, avión, pasaporte, sello, brújula realista.
- **NO gradientes complejos** — máximo 1 color plano + 1 color de acento. Nada de degradados tipo Instagram.
- **NO ilustraciones** ni figuras con detalles finos que se pierdan a 16px.

## 7. Análisis del mark actual

**Asset**: `locallist-landing/img/logo/icon/locallist-icon.svg` — pin geolocalizador con paisaje (montaña + nubes) dentro.

### Qué funciona
- El pin comunica "lugar" inmediato.
- Paisaje interior es editorial-ilustrativo, alineado con pilar 1.

### Qué falla
- **A 16px el paisaje interior se pierde** — queda un pin vacío indistinguible de Google Maps / Foursquare / Yelp / 50 apps más.
- **Colisión de categoría** con Google Maps pin. El usuario ve LocalList en su home screen entre 10 apps con pin. No destacamos.
- **Mensaje demasiado literal**: "ubicación". Pero nuestro producto NO es mapas — es planes editoriales. El mark refuerza el nicho equivocado.

## 8. Dos entregables paralelos: Logo + Mascot/figura emoji

LocalList necesita **dos piezas de identidad distintas**, cada una optimizada para su uso:

### 8.1 Logo principal (el "mark") — tipo Airbnb Bélo / Wanderlog

- **Dónde vive**: app icon (iOS/Android), favicon web, splash screens, header de emails, landing wordmark.
- **Objetivo**: reconocible instantáneamente, memorable, transmite confianza tranquila.
- **Características**: símbolo abstracto con personalidad, simple pero con alma, curvas suaves, legible a 16px.
- **NO necesita** ser emoji-ready — su trabajo es ser el "sello" de la marca en espacios pequeños y grandes.

### 8.2 Mascot / figura emoji (el "personaje") — tipo Duolingo Duo

- **Dónde vive**: dentro de la app, en micro-interacciones animadas (tap CTA, plan generado, stop completado, vibes del wizard, estado vacío, onboarding steps).
- **Objetivo**: darle vida y personalidad a la app, complementar el tono amigable del copy y los colores cálidos.
- **Características**: una figura/personaje con **carácter propio** — puede ser una forma abstracta antropomorfa (ojos + sonrisa + mini-cuerpo), un objeto animable con gesto, o una mascot simbólica. Debe poder tener poses/expresiones variadas para distintos momentos del producto.
- **Relación con el logo**: estéticamente coherente (mismos colores, mismo "feeling" amigable) pero NO obligado a derivarse del mark — puede ser un elemento visual separado.

Esta separación permite que el **mark sea simple y elegante** (sin forzarlo a tener piezas extraíbles) y que la **mascot sea juguetona y expresiva** (sin comprometer la legibilidad del logo en un favicon).

## 9. Direcciones candidatas para el logo principal

Todas respetan pilares + prohibiciones. Objetivo: símbolo memorable con personalidad, no tipografía sola.

### A — "Símbolo abstracto con doble significado" (tipo Airbnb Bélo) ⭐ prioritaria
Una forma orgánica que combine 2-3 conceptos del producto en un solo dibujo — ej. **un check (✓) que se transforma en un camino curvo con un punto final cálido**, **tres líneas tipo "lista" que al final hacen una sonrisa sutil**, o **una forma tipo corazón+marca que dice "lugares que vas a amar"**. Curvas suaves, 2 colores plano máximo. Legible a 16px, interpretable en capas a 1024px.

### B — "Badge/sello curado con carácter" (tipo Wanderlog pin pero sin ser pin)
Un símbolo tipo badge/sello de aprobación con personalidad — NO un pin, sino una forma contenedora con un pequeño gesto o guiño dentro (una curva, un detalle que sugiera aprobación/calidez). La forma "sello" comunica "esto está curado, humano verificó". Más narrativo que A, menos abstracto.

### C — "Gesto de marca + compañero" (tipo Instagram heart-with-pulse)
Una forma principal que evoque marcar/seleccionar/aprobar (check hecho a mano, estrella con terminaciones redondeadas) **acompañada de un pequeño elemento complementario** (un punto, una chispa, un destello). Dos piezas juntas forman el mark; cada una tiene carácter propio.

**Recomendación**: **A como primera exploración** (más cerca de Airbnb Bélo, la referencia que Pablo mencionó). **B como alternativa narrativa**. **C como experimento si las anteriores no convencen**.

## 10. Direcciones candidatas para la mascot/figura emoji

Exploramos POSTERIORMENTE al logo (una vez el logo esté cerrado, diseñamos la mascot coherente con él). Referencias:

- **Duolingo Duo** — búho con personalidad, animaciones variadas, voz propia.
- **GitHub Octocat** — pulpo-gato abstracto, múltiples poses narrativas.
- **Mailchimp Freddie** — chimpancé estilizado, gestos cálidos.
- **Figma hand icons** — pequeños gestos de mano con expresión.

Para LocalList podría ser:
- Una figura antropomorfa muy abstracta (forma redonda con ojos + sonrisa, tipo Blob).
- Un objeto personalizado (ej. una libreta con cara, un sobre que guiña, una bandera/marker amable).
- Un símbolo abstracto que gana carácter por la cara/gesto (tipo emoji oficial pero custom).

**Criterio clave**: que el personaje pueda tener al menos 5-6 poses distintas (feliz, pensativo, celebrando, señalando, sleeping/idle, surprised) para cubrir los momentos de la app sin quedarse corto.

**Nota**: la mascot se diseña en una segunda iteración con Claude Design, una vez el logo principal esté cerrado. Incluirla ahora en el brief para que Claude Design la tenga en contexto, pero el prompt inicial se enfoca en el LOGO.

## 11. Variants mínimos esperados (entregables Fase C)

- `mark.svg` — mark solo, para app icon y splash.
- `monogram.svg` — iniciales comprimidas para favicon 16/32.
- `wordmark-h.svg` — wordmark horizontal (header landing, email).
- `lockup-v.svg` — mark + wordmark vertical (splash screens).
- `*-white.svg` variants para cada uno (dark mode, footers oscuros).

## 12. Fuera de scope (v1)

- Tipografía custom — usamos Playfair Display + Inter existentes.
- Ilustración de marca (ilustraciones dentro del producto).
- Motion / splash animation — decisión posterior.
- Rebrand de tokens de theme — NO cambiamos colors existentes, solo los respetamos.
