# LocalList App

| | Details |
|---|---|
| **Tech** | Expo SDK 54, React Native, Expo Router 4, TypeScript |
| **Deploy** | EAS Build (local) → TestFlight → App Store |
| **Auth** | Apple Sign In + Google OAuth + email/password (HS256 JWT, auto-refresh) |
| **Payments** | RevenueCat SDK (Apple IAP) — **planned, not yet installed** |
| **Storage** | SecureStore (tokens), in-memory cache (api-cache.ts) |
| **iOS Target** | iOS 16.0+ |
| **Privacy** | Privacy manifest configured (4 API types, 3 data types, no tracking) |
| **i18n** | i18next + expo-localization. EN + ES (España). Parity test: `lib/i18n/__tests__/parity.test.ts` |

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

# TestFlight build (requires signing)
git add -A && git commit  # EAS reads git HEAD
eas build --platform ios --profile preview --local
```

Credentials live in EAS (never in repo). `eas.json` configures preview + production profiles.

## Key Screens (`app/`)

| File | Description |
|---|---|
| `_layout.tsx` | Root layout: fonts, SafeAreaProvider, splash animation, AuthGate |
| `(tabs)/_layout.tsx` | Tab bar (Home, Plans, Account) |
| `(tabs)/home.tsx` | Editorial hero, CTA, preference chips |
| `(tabs)/plans.tsx` | Plans list: PhotoHero covers, filter chips, skeleton loading |
| `(tabs)/account.tsx` | Profile, tier badge, language selector, sign out |
| `login.tsx` | Apple Sign In, Google OAuth, email/password, password strength rules |
| `builder/custom.tsx` | AI plan wizard (5-step: city → days → group → preferences → budget) |
| `builder/import-video.tsx` | Stub — import-from-video, not yet built |
| `plan/[id].tsx` | Plan detail: parallax hero, day tabs, inline stop editor, Follow button |
| `follow/[id].tsx` | Follow Mode: PlanMap fullscreen, BottomSheetStop, progress bar, day completion |
| `place/[id].tsx` | Place detail: parallax hero, ratings, Google Maps link |

## Key Components (`components/`)

| Path | Description |
|---|---|
| `ui/PhotoHero.tsx` | Full-bleed image with gradient fallback by category |
| `ui/SkeletonCard.tsx` | Shimmer skeleton loader |
| `ui/design-system/` | ChoiceChip, EditorialTitle, StepSubtitle, ProgressDots — wizard design system |
| `map/PlanMap.tsx` | MapLibre map: pins, route line, animated camera |
| `map/useOfflineTiles.ts` | Offline tile caching hook |
| `follow/StopCard.tsx` | Stop display card: photo, metadata, WhyThisPlace |
| `follow/BottomSheetStop.tsx` | Animated bottom sheet with swipe gestures |
| `follow/FollowDaySheet.tsx` | Day overview sheet inside Follow Mode |
| `plan/PlanCardPager.tsx` | Swipeable plan overview + per-stop cards |
| `plan-editor/DaySection.tsx` | Editable day section with add-stop affordance |
| `plan-editor/SwipeableStopCard.tsx` | Swipe-to-delete stop row |
| `plan-editor/MoveToDay.tsx` | Move stop between days modal |
| `plan-editor/PlaceSearchModal.tsx` | Search places to add to a plan |
| `home/HomeV2.tsx` | Home screen component (rename to HomeScreen.tsx pending) |
| `DestinationScreen.tsx` | **Dead code** — 0 imports, pending deletion (Fase 4 cleanup) |

## Key Libs (`lib/`)

| File | Description |
|---|---|
| `api.ts` | API client: auto JWT refresh, SecureStore token storage |
| `auth.ts` | AuthContext: user state, logout, isPro flag |
| `theme.ts` | Brand tokens: colors, typography, spacing, borderRadius |
| `types.ts` | Shared TypeScript types (Plan, Place, PlanStop, etc.) |
| `i18n/` | i18next setup, EN/ES resources, parity test |
| `plan-store.ts` | Zustand store for plan edit state |
| `use-plan-editor.ts` | Hook: plan editor actions (add/move/delete stops) |
| `bulk-ops.ts` | Batch stop reordering + persistence helpers |
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
- **Commits before EAS build**: EAS reads `git HEAD` — always commit local changes first.
