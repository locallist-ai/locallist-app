# Components

## Directory Structure

```
components/
├── ui/
│   ├── PhotoHero.tsx          # Full-bleed image with gradient overlay/fallback
│   └── SkeletonCard.tsx       # Shimmer loading placeholder
├── map/
│   ├── PlanMap.tsx            # MapLibre map with pins + route line
│   └── useOfflineTiles.ts    # Hook for downloading/caching map tiles
└── follow/
    ├── StopCard.tsx           # Stop info card with photo + metadata
    └── BottomSheetStop.tsx    # Animated swipeable bottom sheet wrapper
```

## Dependency Graph

```
BottomSheetStop
  └── StopCard
        └── PhotoHero

PlanMap (standalone)
useOfflineTiles (standalone hook)
SkeletonCard (standalone)
```

## Props Reference

### PhotoHero (`ui/PhotoHero.tsx`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `imageUrl` | `string?` | — | HTTPS URL (validated, falls back to gradient if missing/invalid) |
| `fallbackCategory` | `Category?` | `'Culture'` | `Food \| Outdoors \| Coffee \| Nightlife \| Culture \| Wellness` |
| `title` | `string?` | — | Title overlay on gradient |
| `subtitle` | `string?` | — | Subtitle overlay on gradient |
| `height` | `number?` | `250` | Container height in px |
| `onImageLoadError` | `() => void?` | — | Callback when image fails to load |

Category gradients: Food (`#f97316`→`#ea580c`), Outdoors (`#10b981`→`#059669`), Coffee (`#92400e`→`#78350f`), Nightlife (`#1e1b4b`→`#312e81`), Culture (`#0f172a`→`#1e293b`), Wellness (`#7c3aed`→`#6d28d9`).

### SkeletonCard (`ui/SkeletonCard.tsx`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `number?` | `280` | Card height |
| `imageHeight` | `number?` | `180` | Image placeholder height |
| `style` | `any?` | — | Additional styles |

Animation: Reanimated 3 `withRepeat(withTiming())`, opacity `0.3→0.8→0.3`, 1500ms loop.

### PlanMap (`map/PlanMap.tsx`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stops` | `MapStop[]` | — | Array of `{id, name, latitude, longitude, category?}` |
| `activePinIndex` | `number?` | `0` | Index of the active (orange, pulsing) pin |
| `onCameraUpdate` | `(center) => void?` | — | Callback with `{latitude, longitude}` on camera move |
| `style` | `any?` | — | Additional styles |

Uses MapLibre with OpenStreetMap tiles (no API key). Pins: blue (`#3b82f6`) inactive, orange (`#f97316`) active with pulsing animation. Route drawn as GeoJSON LineString. Camera flies to active pin on index change (1500ms).

### useOfflineTiles (`map/useOfflineTiles.ts`)

```ts
function useOfflineTiles(stops: {latitude: number; longitude: number}[]): {
  tileUrl: string;        // file:// if cached, https:// if not
  isDownloading: boolean;
  hasCache: boolean;
}
```

Downloads tiles for zoom levels 12-14 (max 10x10 per zoom). Stored in `FileSystem.cacheDirectory/maplibre-tiles/`. Non-blocking, silent failure on individual tiles.

### StopCard (`follow/StopCard.tsx`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stop` | `Stop` | — | `{id, name, category?, neighborhood?, photos?: {url}[], whyThisPlace?, duration?, priceRange?}` |
| `plan` | `Plan?` | — | `{category?}` for fallback gradient |
| `index` | `number?` | `0` | Current stop index |
| `totalStops` | `number?` | `1` | Total number of stops |

Renders PhotoHero (200px) + place name + category badge + neighborhood + WhyThisPlace + duration/price pills.

### BottomSheetStop (`follow/BottomSheetStop.tsx`)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `stop` | `Stop` | — | Same Stop interface as StopCard |
| `plan` | `Plan?` | — | Optional plan context |
| `index` | `number?` | `0` | Current index |
| `totalStops` | `number?` | `1` | Total stops |
| `onSwipeLeft` | `() => void?` | — | Swipe left callback (next) |
| `onSwipeRight` | `() => void?` | — | Swipe right callback (previous) |
| `onPause` | `() => void?` | — | Pause button callback |
| `onSkip` | `() => void?` | — | Skip button callback |
| `onNext` | `() => void?` | — | Next button callback |
| `isPaused` | `boolean?` | `false` | Toggle Pause/Resume label |
| `style` | `ViewStyle?` | — | Additional styles |

Spring entrance (`withSpring`, damping 12). Swipe threshold: 50px. Haptics: light on swipe/next, medium on skip, selection on pause. Wraps in `GestureHandlerRootView`.

## Performance Notes

- All animations run on the native UI thread via Reanimated 3 (60 FPS).
- `expo-image` handles lazy loading and caching automatically.
- `useOfflineTiles` downloads asynchronously without blocking render.
- PlanMap auto-calculates bounds from stops for optimal initial zoom.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Map not rendering | Requires native rebuild: `npx expo run:android` or `npx expo run:ios` |
| Gestures not working | Ensure `GestureHandlerRootView` wraps gesture area (BottomSheetStop includes its own) |
| Images not loading | Check URL starts with `https://` — PhotoHero rejects non-HTTPS |
| Tiles not caching | Verify `expo-file-system` is installed and app has storage permission |
| Shimmer not animating | Ensure `react-native-reanimated` Babel plugin is in `babel.config.js` |
