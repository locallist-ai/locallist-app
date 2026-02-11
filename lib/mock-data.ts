/**
 * Mock data for development — simulates the full API layer.
 * Active only when __DEV__ is true (Expo dev builds).
 */

// ─── Mock User ───────────────────────────────────────────

export const MOCK_USER = {
  id: 'mock-user-001',
  email: 'pablo@locallist.app',
  name: 'Pablo',
  image: null,
  tier: 'pro' as const,
};

// ─── Showcase Plans (Home) ───────────────────────────────

export const MOCK_SHOWCASE_PLANS = [
  {
    id: 'plan-showcase-1',
    name: 'The Perfect Miami Day',
    description: 'From sunrise yoga to rooftop cocktails — a full day hitting the city\'s best.',
    durationDays: 1,
    imageUrl: null,
    type: 'curated',
    isShowcase: true,
  },
  {
    id: 'plan-showcase-2',
    name: 'Foodie Weekend',
    description: 'Two days of the best restaurants, cafés, and hidden gems in Miami.',
    durationDays: 2,
    imageUrl: null,
    type: 'curated',
    isShowcase: true,
  },
  {
    id: 'plan-showcase-3',
    name: 'Art & Culture Trail',
    description: 'Wynwood, PAMM, Design District — the best of Miami\'s creative scene.',
    durationDays: 1,
    imageUrl: null,
    type: 'curated',
    isShowcase: true,
  },
  {
    id: 'plan-showcase-4',
    name: 'Family Fun Weekend',
    description: 'Kid-friendly beaches, Zoo Miami, and the best family restaurants.',
    durationDays: 2,
    imageUrl: null,
    type: 'curated',
    isShowcase: true,
  },
  {
    id: 'plan-showcase-5',
    name: 'Nightlife & Rooftops',
    description: 'The best bars, rooftops, and late-night spots — curated by locals.',
    durationDays: 1,
    imageUrl: null,
    type: 'curated',
    isShowcase: true,
  },
];

// ─── All Plans (Plans Tab) ───────────────────────────────

export const MOCK_ALL_PLANS = [
  ...MOCK_SHOWCASE_PLANS,
  {
    id: 'plan-user-1',
    name: 'My Romantic Weekend',
    description: 'AI-built plan for a couple getaway — oceanfront dining, sunset spots, spa.',
    durationDays: 2,
    imageUrl: null,
    type: 'ai',
    isShowcase: false,
  },
  {
    id: 'plan-user-2',
    name: 'Solo Wellness Day',
    description: 'Morning yoga, healthy brunch, spa, and a quiet beach walk.',
    durationDays: 1,
    imageUrl: null,
    type: 'ai',
    isShowcase: false,
  },
];

// ─── Plan Detail ─────────────────────────────────────────

const MOCK_PLAN_DETAILS: Record<string, any> = {
  'plan-showcase-1': {
    id: 'plan-showcase-1',
    name: 'The Perfect Miami Day',
    description: 'From sunrise yoga to rooftop cocktails — a full day hitting the city\'s best.',
    durationDays: 1,
    type: 'curated',
    isShowcase: true,
    days: [
      {
        dayNumber: 1,
        stops: [
          {
            id: 'stop-1a',
            orderIndex: 0,
            timeBlock: 'morning',
            suggestedArrival: '8:00 AM',
            suggestedDurationMin: 45,
            travelFromPrevious: null,
            place: {
              id: 'place-01',
              name: 'Café La Trova',
              category: 'coffee',
              neighborhood: 'Little Havana',
              whyThisPlace: 'Old-school Cuban coffee with live bolero music — the real Little Havana experience.',
              priceRange: '$$',
            },
          },
          {
            id: 'stop-1b',
            orderIndex: 1,
            timeBlock: 'morning',
            suggestedArrival: '10:00 AM',
            suggestedDurationMin: 90,
            travelFromPrevious: { distance_km: 3.2, duration_min: 8, mode: 'drive' },
            place: {
              id: 'place-02',
              name: 'Pérez Art Museum Miami',
              category: 'culture',
              neighborhood: 'Downtown',
              whyThisPlace: 'World-class contemporary art with stunning Biscayne Bay views from the terrace.',
              priceRange: '$$',
            },
          },
          {
            id: 'stop-1c',
            orderIndex: 2,
            timeBlock: 'afternoon',
            suggestedArrival: '12:30 PM',
            suggestedDurationMin: 60,
            travelFromPrevious: { distance_km: 5.1, duration_min: 12, mode: 'drive' },
            place: {
              id: 'place-03',
              name: 'Mandolin Aegean Bistro',
              category: 'food',
              neighborhood: 'Design District',
              whyThisPlace: 'Mediterranean lunch in a gorgeous courtyard garden — a local favorite.',
              priceRange: '$$$',
            },
          },
          {
            id: 'stop-1d',
            orderIndex: 3,
            timeBlock: 'afternoon',
            suggestedArrival: '2:30 PM',
            suggestedDurationMin: 90,
            travelFromPrevious: { distance_km: 1.8, duration_min: 5, mode: 'walk' },
            place: {
              id: 'place-04',
              name: 'Wynwood Walls',
              category: 'culture',
              neighborhood: 'Wynwood',
              whyThisPlace: 'Iconic outdoor street art museum — the murals rotate so there\'s always something new.',
              priceRange: 'Free',
            },
          },
          {
            id: 'stop-1e',
            orderIndex: 4,
            timeBlock: 'evening',
            suggestedArrival: '6:30 PM',
            suggestedDurationMin: 120,
            travelFromPrevious: { distance_km: 8.5, duration_min: 18, mode: 'drive' },
            place: {
              id: 'place-05',
              name: 'Juvia',
              category: 'food',
              neighborhood: 'South Beach',
              whyThisPlace: 'Rooftop dining with panoramic views — French-Japanese-Peruvian fusion that works.',
              priceRange: '$$$$',
            },
          },
        ],
      },
    ],
  },
  'plan-showcase-2': {
    id: 'plan-showcase-2',
    name: 'Foodie Weekend',
    description: 'Two days of the best restaurants, cafés, and hidden gems in Miami.',
    durationDays: 2,
    type: 'curated',
    isShowcase: true,
    days: [
      {
        dayNumber: 1,
        stops: [
          {
            id: 'stop-2a',
            orderIndex: 0,
            timeBlock: 'morning',
            suggestedArrival: '9:00 AM',
            suggestedDurationMin: 60,
            travelFromPrevious: null,
            place: {
              id: 'place-06',
              name: 'Threefold Café',
              category: 'coffee',
              neighborhood: 'Coral Gables',
              whyThisPlace: 'Australian-style brunch with some of the best avocado toast in Miami.',
              priceRange: '$$',
            },
          },
          {
            id: 'stop-2b',
            orderIndex: 1,
            timeBlock: 'afternoon',
            suggestedArrival: '1:00 PM',
            suggestedDurationMin: 75,
            travelFromPrevious: { distance_km: 6.4, duration_min: 14, mode: 'drive' },
            place: {
              id: 'place-07',
              name: 'KYU',
              category: 'food',
              neighborhood: 'Wynwood',
              whyThisPlace: 'Asian-inspired wood-fired cooking — the cauliflower alone is worth the trip.',
              priceRange: '$$$',
            },
          },
          {
            id: 'stop-2c',
            orderIndex: 2,
            timeBlock: 'evening',
            suggestedArrival: '7:30 PM',
            suggestedDurationMin: 90,
            travelFromPrevious: { distance_km: 4.2, duration_min: 10, mode: 'drive' },
            place: {
              id: 'place-08',
              name: 'Cvi.che 105',
              category: 'food',
              neighborhood: 'Downtown',
              whyThisPlace: 'The best Peruvian ceviche in Miami — always packed, always worth it.',
              priceRange: '$$',
            },
          },
        ],
      },
      {
        dayNumber: 2,
        stops: [
          {
            id: 'stop-2d',
            orderIndex: 0,
            timeBlock: 'morning',
            suggestedArrival: '10:00 AM',
            suggestedDurationMin: 60,
            travelFromPrevious: null,
            place: {
              id: 'place-09',
              name: 'Versailles Restaurant',
              category: 'food',
              neighborhood: 'Little Havana',
              whyThisPlace: 'The most iconic Cuban restaurant in Miami — classic pastelitos and café con leche.',
              priceRange: '$$',
            },
          },
          {
            id: 'stop-2e',
            orderIndex: 1,
            timeBlock: 'afternoon',
            suggestedArrival: '1:30 PM',
            suggestedDurationMin: 60,
            travelFromPrevious: { distance_km: 12.3, duration_min: 22, mode: 'drive' },
            place: {
              id: 'place-10',
              name: 'Joe\'s Stone Crab',
              category: 'food',
              neighborhood: 'South Beach',
              whyThisPlace: 'A Miami institution since 1913 — stone crabs and key lime pie. Legendary.',
              priceRange: '$$$$',
            },
          },
        ],
      },
    ],
  },
};

// Default detail for plans without specific data
function getDefaultPlanDetail(planId: string) {
  const plan = MOCK_ALL_PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  return {
    ...plan,
    days: [
      {
        dayNumber: 1,
        stops: [
          {
            id: `${planId}-stop-1`,
            orderIndex: 0,
            timeBlock: 'morning',
            suggestedArrival: '9:00 AM',
            suggestedDurationMin: 60,
            travelFromPrevious: null,
            place: {
              id: 'place-01',
              name: 'Café La Trova',
              category: 'coffee',
              neighborhood: 'Little Havana',
              whyThisPlace: 'Old-school Cuban coffee with live bolero music — the real Little Havana experience.',
              priceRange: '$$',
            },
          },
          {
            id: `${planId}-stop-2`,
            orderIndex: 1,
            timeBlock: 'afternoon',
            suggestedArrival: '12:00 PM',
            suggestedDurationMin: 75,
            travelFromPrevious: { distance_km: 5.1, duration_min: 12, mode: 'drive' },
            place: {
              id: 'place-03',
              name: 'Mandolin Aegean Bistro',
              category: 'food',
              neighborhood: 'Design District',
              whyThisPlace: 'Mediterranean lunch in a gorgeous courtyard garden — a local favorite.',
              priceRange: '$$$',
            },
          },
          {
            id: `${planId}-stop-3`,
            orderIndex: 2,
            timeBlock: 'evening',
            suggestedArrival: '7:00 PM',
            suggestedDurationMin: 90,
            travelFromPrevious: { distance_km: 8.5, duration_min: 18, mode: 'drive' },
            place: {
              id: 'place-05',
              name: 'Juvia',
              category: 'food',
              neighborhood: 'South Beach',
              whyThisPlace: 'Rooftop dining with panoramic views — French-Japanese-Peruvian fusion that works.',
              priceRange: '$$$$',
            },
          },
        ],
      },
    ],
  };
}

export function getMockPlanDetail(planId: string) {
  return MOCK_PLAN_DETAILS[planId] ?? getDefaultPlanDetail(planId);
}

// ─── Follow Mode ─────────────────────────────────────────

export function getMockFollowData(planId: string, stopIndex: number = 0) {
  const detail = getMockPlanDetail(planId);
  if (!detail) return null;

  const allStops = detail.days.flatMap((d: any) =>
    d.stops.map((s: any) => ({ ...s, dayNumber: d.dayNumber })),
  );

  const clamped = Math.min(stopIndex, allStops.length - 1);
  const current = allStops[clamped];
  const next = allStops[clamped + 1] ?? null;

  return {
    session: {
      id: `mock-session-${planId}`,
      status: clamped < allStops.length - 1 ? 'active' : 'completed',
      currentDayIndex: current.dayNumber - 1,
      currentStopIndex: clamped,
    },
    currentStop: {
      stop: {
        id: current.id,
        timeBlock: current.timeBlock,
        suggestedDurationMin: current.suggestedDurationMin,
      },
      place: {
        ...current.place,
        latitude: '25.7617',
        longitude: '-80.1918',
      },
    },
    nextStop: next
      ? {
          stop: {
            id: next.id,
            timeBlock: next.timeBlock,
            suggestedDurationMin: next.suggestedDurationMin,
          },
          place: {
            ...next.place,
            latitude: '25.7617',
            longitude: '-80.1918',
          },
        }
      : null,
    totalStopsToday: detail.days[current.dayNumber - 1]?.stops.length ?? 0,
    progress: {
      currentDay: current.dayNumber,
      currentStopInDay: current.orderIndex,
      totalStopsToday: detail.days[current.dayNumber - 1]?.stops.length ?? 0,
    },
  };
}
