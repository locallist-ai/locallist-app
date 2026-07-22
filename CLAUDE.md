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
| `_layout.tsx` | Root layout: Sentry init, fonts, SafeAreaProvider, animated splash, preload, AuthGate |
| `index.tsx` | Redirect to `/(tabs)/home` |
| `(tabs)/_layout.tsx` | Tab bar (Home, Plans, Account) |
| `(tabs)/home.tsx` | City picker: hero photo + Skia bg, CityCard grid → sets trip context, routes to `/chat` |
| `(tabs)/plans.tsx` | Plans list: PhotoHero covers, category filter chips, skeleton loading; CTA → `/builder/custom` |
| `(tabs)/account.tsx` | Profile (useProfile: pace/budget/dietary), tier badge, language selector, sign out |
| `login.tsx` | Apple Sign In, Google OAuth, email/password, password strength rules |
| `paywall.tsx` | LocalList Plus paywall (modal iOS): offerings de RevenueCat con precio localizado, compra, restore, links legales; degrada a "no disponible" sin API key/productos |
| `chat/index.tsx` | **Main plan-creation flow**: conversational AI chat — slot extraction (SlotBadges), quick replies, `chatGenerate` → plan, SaveProfileSheet, escape hatch to wizard |
| `builder/wizard.tsx` | AI plan wizard (renders `components/home/HomeScreen` step flow) — escape hatch from chat |
| `builder/custom.tsx` | Manual plan builder: name + debounced city search + days (1–3) → opens `/plan/new` editor |
| `builder/import-video.tsx` | Stub — import-from-video, not yet built |
| `plan/[id].tsx` | Plan detail + editor: PlanCardPager, inline editing via `usePlanEditor`, handles `/plan/new` and builder preview handoff, Follow button |
| `follow/[id].tsx` | Follow Mode: PlanMap fullscreen, BottomSheetStop, progress bar, day completion, resume via `lib/follow/resume-store` |
| `place/[id].tsx` | Place detail: parallax hero, ratings, Google Maps link |

## Key Components (`components/`)

| Path | Description |
|---|---|
| `ui/PhotoHero.tsx` | Full-bleed image with gradient fallback by category |
| `ui/PhotoMosaic.tsx` | Multi-photo mosaic with category gradient fallback |
| `ui/SkeletonCard.tsx` | Shimmer skeleton loader |
| `ui/CategoryBadge.tsx` | Category pill with per-category color |
| `ui/ConfirmModal.tsx` | Reusable confirm/cancel modal |
| `ui/design-system/` | ChoiceChip, EditorialTitle, StepSubtitle, ProgressDots — wizard design system |
| `chat/` | Chat UI: MessageBubble, CityNoticeBubble (aviso de ciudad no cubierta + CTA), ChatErrorBubble (error de infra `ai_unavailable` + reintento), QuickReplyChips, SlotBadges, SaveProfileSheet |
| `account/` | Account screen sections: PlusUpsellCard, ProfileCard, TravelPreferencesSection (consumes useProfile), SettingsSection (settings + legal in-app + actions), DevToolsSection, LanguagePickerModal |
| `auth/` | Login screen pieces: AuthModeToggle, AppleSignInButton, GoogleSignInButton, EmailSignInButton, CredentialsForm, PasswordStrengthIndicator (state/OAuth in `lib/auth/useAuthForm.ts`) |
| `map/PlanMap.tsx` | MapLibre map: pins, route line, animated camera |
| `map/route-geojson.ts` | Pure helper: builds the route LineString GeoJSON (segments by active day or straight-line fallback) |
| `map/useOfflineTiles.ts` | Offline tile caching hook |
| `follow/StopCard.tsx` | Stop display card: photo, metadata, WhyThisPlace |
| `follow/BottomSheetStop.tsx` | Animated bottom sheet with swipe gestures |
| `follow/FollowDaySheet.tsx` | Day overview sheet inside Follow Mode |
| `plan/PlanCardPager.tsx` | Pagination shell (~310 LoC): horizontal pager, current day, progress footer, swipe hint, back pill |
| `plan/PlanEditorContext.tsx` | Context for plan editor state (days, isDirty, isSaving, dispatch, save) — provided from `app/plan/[id].tsx` |
| `plan/PlanEditorModals.tsx` | `PlanEditorModalsHost`: owns move/add/replace modal state, renders MoveToDay + PlaceSearchModal above the pager; exposes request* via context |
| `plan/PlanOverview.tsx` | Overview slide: owner variant (DraggableFlatList editor) + read-only variant, consumes both contexts |
| `plan/DayStopsCarousel.tsx` | Per-stop slides for the current day inside the pager |
| `plan/ChooserMode.tsx` + `plan/MineMode.tsx` + `plan/CuratedMode.tsx` + `plan/SelectionBar.tsx` | Plans tab modes: chooser cards, my-plans list + bulk-select, curated filter/list, bulk-delete bar (orchestrated by `app/(tabs)/plans.tsx`) |
| `plan-editor/DaySection.tsx` | Editable day section with add-stop affordance |
| `plan-editor/EditableStopCard.tsx` | Inline-editable stop row |
| `plan-editor/SwipeableStopCard.tsx` | Swipe-to-delete stop row |
| `plan-editor/MoveToDay.tsx` | Move stop between days modal |
| `plan-editor/PlaceSearchModal.tsx` | Search places to add to a plan |
| `home/HomeScreen.tsx` | AI wizard step flow (used by `builder/wizard.tsx`): WizardStep, InterestsStep + SubcategorySheet, BudgetStep, RefineableStep, ChatStep (legacy), `useWizard` state hook, `useTaxonomy`, constants |
| `home/CityCard.tsx` + `home/HeroSkiaBg.tsx` | City picker card + Skia hero background (home tab) |
| `home/TypingDots.tsx` | Typing indicator (shared with chat) |

## Key Libs (`lib/`)

| File | Description |
|---|---|
| `api.ts` | API client: auto JWT refresh, SecureStore token storage |
| `auth.ts` | AuthContext: user state, logout (desvincula identidad RevenueCat vía `logOutPurchases`), isPro flag, refreshUser (re-fetch /account post-compra) |
| `purchases.ts` | RevenueCat: configure (key por `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`; logIn fallido en cambio de usuario ⇒ false; guarda de época contra logIns tardíos), logOutPurchases (síncrono, no bloqueante), offerings, purchase/restore exigen `expectedAppUserID` de sesión (mismatch módulo/SDK ⇒ `identity_mismatch`, nunca compra con identidad ajena; divergencia nativa invalida la identidad y el retry se cura vía logIn) con poll de `GET /account` hasta el flip del tier; cancelación de usuario no es error |
| `auth/useAuthForm.ts` | Login/register flow hook: choose↔credentials step, Apple/Google OAuth, email validation, password strength (powers `app/login.tsx`) |
| `theme.ts` | Brand tokens: colors, typography, spacing, borderRadius |
| `types.ts` | Shared TypeScript types (Plan, Place, PlanStop, etc.) |
| `i18n/` | i18next setup, EN/ES resources, parity test |
| `plan/plan-store.ts` | In-memory handoff of the builder preview plan (`BuilderResponse`) to `/plan/new` |
| `plan/use-plan-editor.ts` | Hook + reducer: plan editor state and actions (add/move/delete stops, save) |
| `plan/bulk-ops.ts` | Batch stop reordering + persistence helpers |
| `chat-store.ts` | Chat session id persistence (SecureStore) |
| `trip-context-store.ts` | Selected city store (module-level + SafeStore persistence, `useTripContext`) |
| `use-profile.ts` | Hook: user profile CRUD (pace/budget/dietary) via API |
| `analytics.ts` | PostHog REST capture, fire-and-forget `track()` — no-op without `EXPO_PUBLIC_POSTHOG_KEY` |
| `taxonomy.ts` + `taxonomy-fallback.ts` | Interest taxonomy: API fetch with file cache (24h TTL, ETag) + bundled fallback |
| `openingHours.ts` | Open/closed state + hint from `opening_hours` data |
| `responsive.ts` | `useResponsive()`: compact/short flags, width-based `scale`/`scaleFont` |
| `cities.ts` | Static city catalog for the home picker |
| `follow/resume-store.ts` | Persisted Follow Mode resume position per plan |
| `helpers/price.ts` | Price range label formatting |
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
