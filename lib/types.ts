// API response types — mirrors backend schemas

export type Place = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  neighborhood: string | null;
  city: string;
  whyThisPlace: string;
  bestFor: string[] | null;
  suitableFor: string[] | null;
  bestTime: string | null;
  priceRange: string | null;
  photos: string[] | null;
  latitude: string | null;
  longitude: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  source: string;
};

export type PlanStop = {
  placeId: string;
  dayNumber: number;
  orderIndex: number;
  timeBlock: string | null;
  suggestedArrival: string | null;
  suggestedDurationMin: number | null;
  travelFromPrevious: {
    distance_km: number;
    duration_min: number;
    mode: string;
  } | null;
  place: Place | null;
};

export type Plan = {
  id: string;
  name: string;
  city: string;
  type: string;
  description: string | null;
  durationDays: number;
  tripContext: Record<string, unknown> | null;
  isPublic: boolean;
  isShowcase?: boolean;
  isEphemeral?: boolean;
  category?: string; // Category for PhotoHero fallback gradient
  image?: string | null; // Primary image URL
};

export type BuilderResponse = {
  plan: Plan;
  stops: PlanStop[];
  message: string;
  usage: {
    tier: string;
    remaining: number | null;
    limit: number | null;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  tier: 'free' | 'pro';
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type PlanDetailResponse = Plan & {
  days: {
    dayNumber: number;
    stops: (PlanStop & { id: string })[];
  }[];
};
