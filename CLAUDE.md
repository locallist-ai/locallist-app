# LocalList App

| | Details |
|---|---|
| **Tech** | Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript |
| **Deploy** | EAS Build (local) → TestFlight → App Store |
| **Auth** | Apple Sign In + Google OAuth + email/password (HS256 JWT, auto-refresh) |
| **Payments** | RevenueCat SDK (Apple IAP) — `react-native-purchases`, entitlement `plus`. Paywall `app/paywall.tsx`, lógica `lib/purchases.ts`. **Pendiente**: API key + productos en dashboard/ASC (sin key el paywall degrada a "no disponible") |
| **Storage** | SecureStore (tokens), in-memory cache (api-cache.ts) |
| **iOS Target** | iOS 16.0+ |
| **Privacy** | Privacy manifest configured (4 API types, 3 data types, no tracking) |
| **Security** | Cert pinning ATS (`NSPinnedDomains`) vía config plugin `plugins/withCertPinning.js` — pins CA de ISRG contra el dominio de la API; rotación y riesgos documentados en el propio plugin |
| **i18n** | i18next + expo-localization. EN + ES (España). Parity test: `lib/i18n/__tests__/parity.test.ts` |
| **Tests** | Jest (jest-expo) — `npm test`. Suites in `lib/__tests__/`, `lib/plan/__tests__/`, `lib/follow/__tests__/`, `components/map/__tests__/`, `components/chat/__tests__/`, `components/account/__tests__/` |
| **Analytics** | PostHog via REST (`lib/analytics.ts`) — no-op unless `EXPO_PUBLIC_POSTHOG_KEY` is set |
| **Errors** | Sentry (`@sentry/react-native`), init in `lib/sentry.ts` |

## Running Locally

```bash
cd locallist-app
npx expo start --dev-client
```

Requires a **development build** installed on device/simulator — Expo Go will not work (native modules).

## iOS Builds (EAS local)

```bash
# Simulator debug build (fast, no signing)
npx expo run:ios --configuration Debug

# EAS builds: siempre a través del wrapper, nunca `eas build` a pelo
git add -A && git commit  # EAS reads git HEAD
npm run build:ios   # production (.ipa, TestFlight; production profile auto-incrementa buildNumber)
npm run build:sim   # preview / simulator (.tar.gz)
```

Artifacts land in `builds/<profile>-<date>-<sha>.<ext>` (gitignored). The wrapper (`scripts/build-local.sh`) prunes automatically and keeps only the 2 most recent builds per profile, so no stray `build-*.ipa` ever piles up in the repo root.

Credentials live in EAS (never in repo). `eas.json` configures development + preview (simulator) + production profiles; `submit.production` targets the "Friends Testing" TestFlight group.

## Key Screens (`app/`)

| File | Description |
|---|---|
| `_layout.tsx` | Root layout: Sentry init, fonts, SafeAreaProvider, animated splash, preload, **EntryGate** (guest mode: invitado O autenticado entran a la app; onboarding solo primera ejecución vía `lib/entry-state` + `lib/onboarding-store`) |
| `index.tsx` | Redirect to `/(tabs)/home` |
| `onboarding/index.tsx` | Orquestador del onboarding (W2 + W5): máquina de 3 pasos de valor (valor / gustos / preview, en `components/onboarding/`) + paso paywall (timeline, W5) + swap a login inline con salida (fix del dead-end de W1) + analytics de pasos + completion. SIN paso de ciudad: la ciudad se elige siempre en el home (builder-first, #91), nunca aquí. Renderizado directo por el EntryGate (sin navigator) |
| `(tabs)/_layout.tsx` | Tab bar (Home, Plans, Account) |
| `(tabs)/home.tsx` | City picker: hero photo + Skia bg, CityCard grid → sets trip context, routes to `/builder/wizard` (flujo primario desde 2026-07-24) |
| `(tabs)/plans.tsx` | Plans list: PhotoHero covers, category filter chips, skeleton loading; CTA → `/builder/custom` |
| `(tabs)/account.tsx` | Profile (useProfile: pace/budget/dietary), tier badge, language selector, sign out |
| `login.tsx` | Apple Sign In, Google OAuth, email/password, password strength rules. Prop opcional `onClose` (salida del dead-end): el onboarding lo renderiza inline con un back a las pantallas de valor; como ruta modal va sin `onClose` (dismiss nativo). **Modo inicial**: los orígenes de intención "crear cuenta" (gate de signup, gancho "guardar este plan" del onboarding) abren en REGISTER, no en log-in, vía prop `initialMode` (inline) o route param `/login?intent=register` (`mode=register` alias; la prop gana). Sin intención sigue en log-in |
| `paywall.tsx` | LocalList Plus paywall (modal iOS): offerings de RevenueCat con precio localizado, compra, restore, links legales; degrada a "no disponible" sin API key/productos |
| `chat/index.tsx` | **Flujo SECUNDARIO opt-in** (desde 2026-07-24): conversational AI chat — AiDisclaimerBanner (aviso de IA bajo el header), slot extraction (SlotBadges), quick replies, `chatGenerate` → plan, SaveProfileSheet, escape al wizard vía `router.dismissTo` (POP_TO: reusa la instancia de wizard del stack; `navigate` re-pushearía una ruta enterrada) |
| `builder/wizard.tsx` | **Flujo PRIMARIO de creación de planes** (renders `components/home/HomeScreen` step flow); el 1er paso (DurationStep) tiene un link discreto opt-in al chat (`router.push('/chat')`) |
| `builder/custom.tsx` | Manual plan builder: name + debounced city search + days (1–3) → opens `/plan/new` editor |
| `builder/import-video.tsx` | Import a plan from your OWN travel video OR photo (F2 T5, Plus). Picks a video or image via a REQUIRE-GUARDED expo-image-picker (`lib/import/native-picker`; no native module ⇒ "update needed" notice, never a startup crash), client-validates size/duration/format per media kind (`lib/import/validate`; images skip the duration check, 25 MB cap), tags analytics with `mediaKind` ('video'|'image'), multipart-uploads with progress (`importVideo` in `lib/api`, XHR to reuse `getAccessToken`+refresh), then lists extracted candidates (matched = selectable + preselected with confidence badge; non-matched = "not on LocalList", shown but not selectable) + tier-aware day picker + optional name → `createImportPlan` → opens `/plan/{id}`. Guest→signup gate, free→`import_requires_plus` upsell. Idle screen has a **platform selector** (Mi vídeo=self default / TikTok / Instagram / Otro) as ATTRIBUTION — the video is always a file the user picked, we never touch TikTok/Instagram; `platform != self` shows a prominent disclaimer + optional `creatorHandle` (sanitized trim/64, not logged) and rides `Import:ThirdPartyEnabled` server-side (403 `third_party_import_disabled` → "not available yet" copy). Analytics carry `platform`, never the handle |
| `plan/[id].tsx` | Plan detail + editor: PlanCardPager, inline editing via `usePlanEditor`, handles `/plan/new` and builder preview handoff, Follow button. Owner-only **ShareButton** (floating pill top-right, gated by `shouldShowShareButton`: nunca en `id==='new'` sin persistir; preview SÍ, ya está persistido y es del caller): `POST /plans/{id}/share` (idempotente) → native Share sheet con el enlace `https://locallist.ai/p/{shareToken}`; long-press → ActionSheet Compartir/Dejar de compartir → `DELETE /share` con ConfirmModal. Eventos `plan_share_opened`/`plan_share_revoked` (sin ids) |
| `follow/[id].tsx` | Follow Mode: PlanMap fullscreen, BottomSheetStop, progress bar, day completion, resume via `lib/follow/resume-store`. Real-time connectivity via `useConnectivity` → `OfflineBanner` when offline + flushes #108's durable mutation-queue on offline->online reconnect |
| `place/[id].tsx` | Place detail: parallax hero, ratings, Google Maps link, favorite heart over the hero |
| `favorites.tsx` | Favorites screen: paginated list (infinite scroll) of favorited PlaceDto (PhotoHero cards + heart to remove, optimista), pull-to-refresh, empty state, tap → place detail. Filters the fetched page by the live `useFavorites` id set (removal + revert reflect instantly). Pagination offset SIGUE AL BACKEND (`visible.length`, nunca el array crudo — quitar filas y paginar no deja huecos) with a per-fetch purge of removed rows; empty state SOLO con `effectiveTotal === 0` (vaciar la página cargada auto-carga la siguiente, nunca empty falso) |

## Key Components (`components/`)

| Path | Description |
|---|---|
| `ui/PhotoHero.tsx` | Full-bleed image with gradient fallback by category. Resolves relative proxy URLs (`lib/helpers/photo-url.ts`) and shows a discreet "Google" `PhotoAttribution` overlay when `photoSource === 'google'` (Places API ToS) |
| `ui/PhotoMosaic.tsx` | Multi-photo mosaic with category gradient fallback. Accepts `PhotoMosaicItem` (`string \| { url, photoSource }`) so each tile can carry its own Google attribution |
| `ui/PhotoAttribution.tsx` | Discreet "Google" label overlay for photos with `photoSource === 'google'`; v1 = brand name only, per-photo author (`authorAttributions`) is v1.1 |
| `ui/SkeletonCard.tsx` | Shimmer skeleton loader |
| `ui/CategoryBadge.tsx` | Category pill with per-category color |
| `ui/FavoriteButton.tsx` | Favorite affordance in the branded bubble language (same contract as ChoiceChip icon bubbles): unfavorited = paperWhite bubble (subtle sunsetOrange border) + `MaterialCommunityIcons` `heart-outline` in sunsetOrange; favorited = sunsetOrange bubble + filled `heart` in white. Heart is ALWAYS an icon, never emoji (brand contract); the paperWhite bubble keeps it legible over any photo. Optimistic toggle via `useFavorites`; a guest tap routes to the signup gate. Used on `place/[id]`, `StopCard`, and the favorites list |
| `ui/ConfirmModal.tsx` | Reusable confirm/cancel modal |
| `ui/design-system/` | ChoiceChip, EditorialTitle, StepSubtitle, ProgressDots — wizard design system |
| `chat/` | Chat UI: MessageBubble, AiDisclaimerBanner (aviso fijo "es una IA, puede cometer errores"), CityNoticeBubble (aviso de ciudad no cubierta + CTA), ChatErrorBubble (error de infra `ai_unavailable` + reintento), QuickReplyChips, SlotBadges, SaveProfileSheet |
| `account/` | Account screen sections: PlusUpsellCard, ProfileCard, TravelPreferencesSection (consumes useProfile), SettingsSection (settings + legal in-app + actions), DevToolsSection, LanguagePickerModal |
| `paywall/TrialTimeline.tsx` | Timeline vertical Hoy→Día N-2→Día N+1 de la fase `ready` del paywall (sin urgencia/countdowns): promesa real del recordatorio del trial + primer cobro con el precio interpolado. Días DERIVADOS de `introPrice.periodNumberOfUnits`/`periodUnit` (`lib/trial-timeline.ts`), nunca hardcodeados. Se monta solo si el package tiene trial real (introPrice gratuito) Y el usuario es ELEGIBLE (`checkTrialEligibility` en el paywall) |
| `auth/` | Login screen pieces: AuthModeToggle, AppleSignInButton, GoogleSignInButton, EmailSignInButton, CredentialsForm, PasswordStrengthIndicator (state/OAuth in `lib/auth/useAuthForm.ts`) |
| `onboarding/` | Pantallas del flujo W2 (orquestadas por `app/onboarding/index.tsx`): OnboardingBackground (chrome CLARO — gradiente crema warm→cool + `OnboardingSkiaBg` (motivo de itinerario animado light-tuned: pins sunsetOrange + ruta punteada en drift + walker electricBlue, reusa la técnica Skia/reanimated de `home/HeroSkiaBg` pero recoloreado como decoración sutil) + ProgressDots con `colorPending` oscuro; pantallas hijas asumen fondo claro (deepOcean/textMain, sin sombras)), OnboardingValueScreen, OnboardingTasteScreen (interests vía `useTaxonomy` + budget con ChoiceChip `idleBorderColor` oscuro), OnboardingPreviewScreen (plan curado real vía `/plans?showcase=true` + `/plans/:id`, fallback genérico por gradiente). SIN pantalla de ciudad (se elige en el home, builder-first) |
| `map/PlanMap.tsx` | MapLibre map: pins, route line, animated camera. Basemap ENV-conditional (`lib/map/tiles.ts`): with `EXPO_PUBLIC_TILES_URL` uses the self-hosted Protomaps style + OSM/Protomaps attribution and drives per-plan OFFLINE packs; without it, OpenFreeMap online (today's default). In `followMode` shows an offline download/status pill |
| `map/route-geojson.ts` | Pure helper: builds the route LineString GeoJSON (segments by active day or straight-line fallback) |
| `map/useOfflinePack.ts` | Hook (follow + tiles enabled): ensures the plan's offline pack via `lib/map/offline-packs.ts` (wrapper over MapLibre `OfflineManager`: bbox+padding, `setTileCountLimit` before `createPack` z0-15, LRU eviction cap 3, require-guarded native module). Exposes `{status, percentage, retry}`, degrades to online. Needs the `locallist-tiles` infra (`tiles.locallist.ai`) deployed to actually pack |
| `follow/OfflineBanner.tsx` | Discreet real-time connectivity pill in Follow Mode (MCI `wifi-off` + `follow.offlineLive`, EN+ES): renders ONLY when `isOffline`, non-blocking. Fed by `useConnectivity` from `app/follow/[id].tsx`; distinct from the `offlineCached` disk-cache badge |
| `follow/StopCard.tsx` | Stop display card: photo, metadata, WhyThisPlace |
| `follow/BottomSheetStop.tsx` | Animated bottom sheet with swipe gestures |
| `follow/FollowDaySheet.tsx` | Follow Mode sheet: centered day STEPPER (‹ Day X of N ›, arrows call `onChangeDay`, disabled at ends, hidden with 1 day) + one large PAGINATED stop card (‹ N / M › arrows + swipe call `onSelect(linearIndex)` to step ±1 stop within the day, disabled at first/last) + Complete-trip footer. Always mirrors `currentIndex` (sheet, map pin and "current" are one) |
| `plan/PlanCardPager.tsx` | Pagination shell (~310 LoC): horizontal pager, current day, progress footer, swipe hint, back pill |
| `plan/PlanEditorContext.tsx` | Context for plan editor state (days, isDirty, isSaving, dispatch, save) — provided from `app/plan/[id].tsx` |
| `plan/PlanEditorModals.tsx` | `PlanEditorModalsHost`: owns move/add/replace modal state, renders MoveToDay + PlaceSearchModal above the pager; exposes request* via context |
| `plan/PlanOverview.tsx` | Overview slide: owner variant (DraggableFlatList editor) + read-only variant, consumes both contexts |
| `plan/DayStopsCarousel.tsx` | Per-stop slides for the current day inside the pager |
| `plan/ChooserMode.tsx` + `plan/MineMode.tsx` + `plan/CuratedMode.tsx` + `plan/SelectionBar.tsx` | Plans tab modes: chooser cards, my-plans list + bulk-select, curated filter/list, bulk-delete bar (orchestrated by `app/(tabs)/plans.tsx`) |
| `plan/ShareButton.tsx` | Owner share pill (Social S1): tap → `sharePlan` (POST idempotente) → Share sheet nativo con `https://locallist.ai/p/{shareToken}`; long-press tras compartir → ActionSheet re-compartir/revocar (`unsharePlan` + ConfirmModal, Alerts reintenables). Exporta `shouldShowShareButton` puro (nunca `id==='new'`; preview sí). Eventos `plan_share_opened`/`plan_share_revoked` sin ids. Montado por `app/plan/[id].tsx` |
| `plan-editor/DaySection.tsx` | Editable day section with add-stop affordance |
| `plan-editor/EditableStopCard.tsx` | Inline-editable stop row |
| `plan-editor/SwipeableStopCard.tsx` | Swipe-to-delete stop row |
| `plan-editor/MoveToDay.tsx` | Move stop between days modal |
| `plan-editor/PlaceSearchModal.tsx` | Search places to add to a plan |
| `home/HomeScreen.tsx` | AI wizard step flow (used by `builder/wizard.tsx`): DurationStep (tier-aware day pills 1..14 Plus / 1..3 free + upsell), InterestsStep + SubcategorySheet, BudgetStep, RefineableStep, generating overlay, `useWizard` state hook (steps 1-4 + activeSteps, guest gate + gate-error mapping + quota), `useTaxonomy`, constants |
| `home/CityCard.tsx` + `home/HeroSkiaBg.tsx` | City picker card + Skia hero background (home tab) |
| `home/CityRequestInline.tsx` | "Pide tu ciudad" compartido (onboarding + home): link discreto → TextInput inline (autofocus ref+setTimeout) + enviar. Validación cliente espejo del server (máx 100, regex unicode) antes de `POST /cities/request`; estados enviando/ack/400/429/red; `track({event:'city_request_submitted', source})` solo en éxito (sin PII). Prop `variant` claro/oscuro |
| `home/TypingDots.tsx` | Typing indicator (shared with chat) |

## Key Libs (`lib/`)

| File | Description |
|---|---|
| `api.ts` | API client: auto JWT refresh, SecureStore token storage |
| `gate-errors.ts` | Pure mapping of `{status, errorBody}` → `GateAction` (signup_required / upsell / soft_throttle / rate_limit / generic) for the Plus gate, plus tolerant parsers for `/account` `aiPlansMonth` quota and the generation `clamped` hint |
| `useGateHandler.ts` | Hook: presents a `GateAction` as UI (Alert upsell/signup/throttle, CTA to `/login` or `/paywall`) + `presentClamped` notice (guarded by `isPro`). Single place for gate copy/CTA. `presentGate(action, { onDismiss })` (signup gate): hook de descarte para callers con intent pendiente detrás del gate (favoritos) |
| `auth.ts` | AuthContext: user state, logout (desvincula identidad RevenueCat vía `logOutPurchases`), isPro flag, refreshUser (re-fetch /account post-compra), `aiPlansMonth` quota (parsed from `/account`, poblada tras auto-login y `login()` interactivo, refrescada tras cada generación) |
| `purchases.ts` | RevenueCat: configure (key por `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`; sin uid SIEMPRE false — sin sesión no hay paywall; logIn fallido en cambio de usuario ⇒ false; configures concurrentes del mismo uid coalescen), cola de identidad que serializa logIn/logOut/purchase/restore (nunca se vende con ops de identidad pendientes), guarda de época contra logIns tardíos y TOCTOU (re-validación tras cada await y dentro del slot de venta), logOutPurchases (síncrono, no bloqueante; logOut nativo encolado tras logIns en vuelo), offerings, purchase/restore exigen `expectedAppUserID` de sesión (mismatch ⇒ `identity_mismatch`, nunca compra con identidad ajena; divergencia nativa invalida y el retry se cura vía logIn; el paywall se recupera con re-load) con poll de `GET /account` hasta el flip del tier; cancelación de usuario no es error; cachea el país del storefront tras configure (`getCachedStorefront`, lo consume analytics). `checkTrialEligibility` (READ-ONLY, fuera de la cola de identidad): normaliza `checkTrialOrIntroductoryPriceEligibility` a un union por productId; el paywall solo pinta framing de trial con status `ELIGIBLE` (Apple no filtra el introPrice por historial de canje). Contratos de carreras: `purchases.identity-contract.test.ts` |
| `auth/useAuthForm.ts` | Login/register flow hook: choose↔credentials step, Apple/Google OAuth, email validation, password strength (powers `app/login.tsx`) |
| `theme.ts` | Brand tokens: colors, typography, spacing, borderRadius |
| `types.ts` | Shared TypeScript types (Plan, Place, PlanStop, etc.) |
| `i18n/` | i18next setup, EN/ES resources, parity test |
| `plan/plan-store.ts` | In-memory handoff of the builder preview plan (`BuilderResponse`) to `/plan/new` |
| `plan/use-plan-editor.ts` | Hook + reducer: plan editor state and actions (add/move/delete stops, save) |
| `plan/bulk-ops.ts` | Batch stop reordering + persistence helpers |
| `chat-store.ts` | Chat session id persistence (SecureStore) |
| `trip-context-store.ts` | Selected city store (module-level + SafeStore persistence, `useTripContext`) |
| `onboarding-store.ts` | First-run onboarding state (`onboarding_completed` + `onboarding_prefs`), SafeStore-persisted (muere con la desinstalación, NO Keychain); `useOnboarding`, `completeOnboarding`, getters sync. Mismo patrón que `trip-context-store` |
| `entry-state.ts` | Pure decision del EntryGate (`resolveEntryState` → loading/onboarding/app + `isGuestSession`) — invitado O autenticado entran a la app, onboarding solo primera ejecución |
| `favorites-store.ts` | Favorites: cache module-level del Set de ids (mismo patrón que `trip-context-store`). `loadFavoriteIds`/`clearFavorites`/`applyPendingFavorite` wired desde `lib/auth` (hidrata en login+auto-login, limpia en logout, replay del pending guest tras login). `useFavorites()` hook = ids + `loading`/`loaded` + `toggle(placeId, source)` OPTIMISTA con revert y guard de op en vuelo por placeId (doble-tap = ignorado, nunca PUT/DELETE en carrera). Invitado: no toca la API — guarda `pendingFavoritePlaceId` (no persistente, last-wins) + gate de signup; descartar el gate sin ir a login LIMPIA el pending (sin favoritos fantasma). 403 `favorites_limit_reached` → `favorites_limit_hit` + upsell vía useGateHandler. In-memory only (el backend es la verdad) |
| `onboarding-sync.ts` | Sync diferido de `onboarding_prefs` → `PUT /me/profile` (mapea budget/pace/dietary/city) en el primer `login()`/registro, luego limpia. `mapPrefsToProfile` pura (null si nada mapea, salta la red); best-effort (un fallo conserva las prefs para el siguiente intento) |
| `clone-plan-store.ts` | "Guardar este plan" del onboarding (mismo patrón pending que `favorites-store`). Invitado toca "Guardar este plan" en la preview → `setPendingClonePlan` (last-wins, no persistente) + registro inline; `applyPendingClonePlan` wired en `lib/auth` `login()` clona (`POST /plans/{id}/clone`, `clonePlan` en `api.ts`), emite `onboarding_completed{skippedPaywall:true}` (la cohorte que convierte por el gancho cuenta en el funnel; `login()` completa el onboarding en esta ruta) + `onboarding_plan_saved{viaSignup:true}` y stagea el landing id. Hook `usePendingCloneLanding` (montado por el AppStack en `_layout`) navega al plan clonado: consume el landing ya stageado al montar + `subscribeCloneLanding` para el que llega justo después (el gate flipa onboarding→app antes de que el clone async acabe). Descartar el registro LIMPIA el pending; logout `clearCloneState`. Clone fallido = log + aterriza home, nunca atasca (TODO polish: destello home→plan ~1-2s). Showcase = Miami-only ⇒ clon Miami (documentado) |
| `use-profile.ts` | Hook: user profile CRUD (pace/budget/dietary) via API |
| `import/` | Import-from-video/image helpers (F2 T5). `native-picker.ts`: REQUIRE-GUARDED expo-image-picker (`pickVideo` abre vídeos E imágenes y etiqueta cada asset con `kind` 'video'|'image'; sin el módulo nativo degrada a `unavailable`, nunca crash de arranque — mismo patrón que `trial-reminder/native-module`). `validate.ts`: validación cliente PURA por `kind` (vídeo 150MB/10min mp4·mov·webm; imagen 25MB SIN duración jpg·png·webp·heic) + `resolveUploadMime`. La subida multipart (`importVideo`) y `createImportPlan` viven en `lib/api.ts` |
| `trial-reminder/` | Recordatorio local del día 5 del trial (promesa "aviso el día 5, cobro el día 8"). Se programa SOLO con trial REAL (`entitlementPeriodType 'TRIAL'` del outcome de compra — elegibilidad del usuario, no el introPrice del producto); una compra efectiva sin trial cancela el pendiente obsoleto (cambio de plan). `native-module.ts`: require perezoso+guardado de expo-notifications — sin el módulo nativo (binario pre-rebuild) TODO el API degrada a no-op, jamás crash de arranque. `logic.ts` pura e inyectable (trigger compra+5d a las 10:00 locales — margen al cobro [37h,62h] con DST, siempre >24h; idempotencia por identificador; gracia de 24h para `pending_backend`; sesgo a conservar ante ambigüedad); `index.ts` wiring — SOLO locales, config plugin NO registrado a propósito (añadiría el entitlement push `aps-environment`) — con permiso pedido EN la compra con trial (nunca en arranque; denegado = log, la compra sigue), contenido i18n congelado al programar y `purchasedAt` persistido en el payload; `useTrialReminder` (AppStack): handler foreground, tap → `trial_reminder_shown {day:5}` + deep link a cuenta (el tap es la única señal observable con la app matada), reconciliación por `isPro` (pro→free o free fuera de gracia ⇒ cancel). Logout cancela vía `lib/auth` |
| `analytics.ts` | PostHog REST capture, fire-and-forget `track()` — no-op without `EXPO_PUBLIC_POSTHOG_KEY`. Anon `distinct_id` persistente (UUID en fichero local `analytics_anon_id` — sobrevive reinicios, MUERE con la desinstalación; nunca Keychain, sería un device-id no reseteable) + `$identify` en anon→user; todos los eventos llevan `country` (locale) y `storefront` (caché RevenueCat) cuando hay valor; `trackPlanLimitIfGate403` emite `plan_limit_hit` desde los 403 estructurados de gates Plus (wired en `api.ts`) |
| `taxonomy.ts` + `taxonomy-fallback.ts` | Interest taxonomy: API fetch with file cache (24h TTL, ETag) + bundled fallback |
| `openingHours.ts` | Open/closed state + hint from `opening_hours` data |
| `responsive.ts` | `useResponsive()`: compact/short flags, width-based `scale`/`scaleFont` |
| `cities.ts` | Static city catalog for the home picker |
| `follow/resume-store.ts` | Persisted Follow Mode resume position per plan |
| `connectivity/` | Real-time online/offline detection. `netinfo-module.ts`: REQUIRE-GUARDED `@react-native-community/netinfo` (no config plugin; a pre-rebuild binary degrades to "assume online", never a startup crash — same pattern as `map/location-module` / `trial-reminder/native-module`). `use-connectivity.ts`: `useConnectivity({ onReconnect? })` hook + pure `computeIsOffline` — subscribes to `NetInfo.addEventListener`, exposes `{ isOffline }`, treats null/unknown as online (never offline), cleans up on unmount, and fires `onReconnect` ONLY on the offline -> online transition. Distinct from `follow.offlineCached` (disk cache) |
| `helpers/price.ts` | Price range label formatting |
| `helpers/photo-url.ts` | Resolves a place photo URL from the backend's Google photo proxy: absolute passes through, relative (`/places/{id}/photos/0`, no `Api:PublicBaseUrl` on the backend) resolves against `EXPO_PUBLIC_API_URL`; unrecognized/empty → `null` so callers fall back to the category gradient |
| `trial-timeline.ts` | Derivación PURA de la duración del trial (introPrice DAY/WEEK/MONTH/YEAR → días) y del timeline del paywall (recordatorio N-2, cobro N+1). Nada hardcodeado a 7; alimenta `paywall/TrialTimeline.tsx` |
| `api-cache.ts` | Simple in-memory stale-while-revalidate cache |
| `safe-store.ts` | SecureStore wrapper with web fallback |
| `timeBlocks.ts` | Time block constants + icon map (Morning/Afternoon/Evening/Night) |
| `logger.ts` | Leveled logger (`debug` in dev, `warn+` in prod) — use instead of console.log |
| `sentry.ts` | Sentry init + wrap helpers |
| `preload.ts` | Preloads plan list + images during splash |

## Conventions

- **i18n**: always use `t('key')` — never hardcode visible strings. Add keys to both `en.ts` and `es.ts`. Parity test will catch drift.
- **Logging**: `logger.debug/info/warn/error(msg, obj)` — never `console.log`.
- **`autoFocus` inside Animated.View**: use `ref + setTimeout` post-animation, not `autoFocus` prop directly (iOS crash).
- **Analytics**: `track({ event, ... })` from `lib/analytics.ts` for funnel events — never call PostHog directly.
- **Commits before EAS build**: EAS reads `git HEAD` — always commit local changes first.
