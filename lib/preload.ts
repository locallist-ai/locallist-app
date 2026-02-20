/**
 * App preloader — runs during splash screen to warm up data and images.
 * By the time the user sees the Plans tab, everything is already cached.
 */
import { Image as ExpoImage } from 'expo-image';
import { api } from './api';
import { getCached, setCache } from './api-cache';
import type { Plan } from './types';

// Local cover images to decode during splash
const COVER_SOURCES = [
  require('../assets/images/plans/romantic-weekend.webp'),
  require('../assets/images/plans/foodie-weekend.webp'),
  require('../assets/images/plans/outdoor-adventure.webp'),
  require('../assets/images/plans/family-fun.webp'),
  require('../assets/images/plans/culture-art-crawl.webp'),
];

const PLANS_CACHE_KEY = 'plans_showcase';

let preloadStarted = false;

/**
 * Preload plans data + cover images in parallel.
 * Safe to call multiple times (no-ops after first call).
 */
export async function preloadPlans(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;

  try {
    await Promise.all([
      // 1. Fetch plans data from API and cache it
      (async () => {
        if (getCached<Plan[]>(PLANS_CACHE_KEY)) return; // already cached
        const res = await api<{ plans: Plan[] }>('/plans?showcase=true');
        if (res.data) {
          const list = res.data.plans ?? [];
          list.sort((a, b) => {
            if (a.name === 'Family Fun in Miami') return -1;
            if (b.name === 'Family Fun in Miami') return 1;
            return 0;
          });
          setCache(PLANS_CACHE_KEY, list);
        }
      })(),

      // 2. Prefetch local cover images so they're decoded and ready
      ...COVER_SOURCES.map((src) =>
        ExpoImage.prefetch(src).catch(() => {}),
      ),
    ]);
  } catch {
    // Preload is best-effort — never block the app
  }
}
