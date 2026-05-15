// API response types — mirrors backend schemas

export type OpeningTime = {
  day: number;
  hour: number;
  minute: number;
};

export type OpeningPeriod = {
  open: OpeningTime | null;
  close: OpeningTime | null;
};

export type OpeningHours = {
  periods: OpeningPeriod[];
  weekdayDescriptions: string[];
};

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
  latitude: number | null;
  longitude: number | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  source: string;
  openingHours: OpeningHours | null;
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

export type RouteSegment = {
  dayNumber: number;
  fromOrderIndex: number;
  toOrderIndex: number;
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
};

export type PlanDetailResponse = Plan & {
  createdById?: string;
  days: {
    dayNumber: number;
    stops: (PlanStop & { id: string })[];
  }[];
  routeSegments?: RouteSegment[];
};

export type StopInput = {
  placeId: string;
  dayNumber: number;
  orderIndex: number;
  timeBlock: string | null;
  suggestedDurationMin: number | null;
};

export type UpdateStopsRequest = {
  stops: StopInput[];
};

export type CityDto = {
  id: string;
  name: string;
  country?: string | null;
  source: 'seed' | 'user';
};

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatSlots = {
  city: string | null;
  days: number | null;
  groupType: string | null;
  categories: string[] | null;
  budget: string | null;
  pace: string | null;
  dietary: string[] | null;
  exclusions: string[] | null;
  vibesPrimary: string | null;
};

export type QuickReply = {
  id: string;
  label: string;
};

export type ChatTurnRequest = {
  sessionId: string | null;
  message: string;
  quickReplyId: string | null;
  preSeededSlots?: { city?: string };
};

export type ChatTurnResponse = {
  sessionId: string;
  aiMessage: string;
  slots: ChatSlots;
  missingCritical: string[];
  quickReplies: QuickReply[];
  ready: boolean;
  turnCount: number;
  turnLimit: number;
};

export type ChatGenerateRequest = {
  sessionId: string;
};

export type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  quickReplies?: QuickReply[];
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export type UserProfile = {
  defaultGroupType: string | null;
  companionTags: string[];
  dietaryRestrictions: string[];
  pacePreference: string | null;
  defaultBudgetTier: string | null;
  favoriteCity: string | null;
  updatedAt: string;
};

export type UpsertProfileRequest = {
  defaultGroupType?: string | null;
  companionTags?: string[] | null;
  dietaryRestrictions?: string[] | null;
  pacePreference?: string | null;
  defaultBudgetTier?: string | null;
  favoriteCity?: string | null;
};
