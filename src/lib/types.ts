export type Source = 'official' | 'verified' | 'community' | 'ai';
export type ReviewStatus = 'verified' | 'needs_review' | 'expired' | 'community' | 'under_review';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  travel_styles: string[];
  traveller_type: string | null;
  budget_preference: string | null;
  onboarded: boolean;
  notif_push: boolean;
  notif_email: boolean;
  notif_trip_reminders: boolean;
  notif_promos: boolean;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  state: string;
  country: string;
  categories: string[];
  tagline: string | null;
  description: string | null;
  hero_image: string | null;
  best_time: string | null;
  recommended_days: number;
  budget_min: number | null;
  budget_max: number | null;
  weather: string | null;
  transportation: string | null;
  safety_information: string | null;
  emergency_information: string | null;
  local_rules: string | null;
  latitude: number | null;
  longitude: number | null;
  popularity: number;
  rating: number | null;
  status: 'draft' | 'published' | 'archived';
  source_type: Source;
  source_url: string | null;
  last_verified: string | null;
  review_date: string | null;
  // India catalogue (migration 005)
  state_id?: string | null;
  district?: string | null;
  destination_type?: string | null;
  alt_names?: string[];
  best_months?: number[];
  season_notes?: string | null;
  highlights?: string[];
  hidden_gems?: string[];
  food?: string[];
  traveller_profiles?: string[];
  accessibility?: string | null;
  nearest_airport?: string | null;
  nearest_railway?: string | null;
  budget_tier?: 'budget' | 'standard' | 'premium' | null;
  unesco?: boolean;
  source_org?: string | null;
  verification_status?: VerificationStatus;
  completeness?: number;
  missing_fields?: string[];
  state_name?: string;
  region_id?: string;
  distance_km?: number;
}

export type VerificationStatus = 'verified' | 'partially_verified' | 'estimated' | 'unverified';

export interface Region { id: string; name: string; sort_order: number; description: string | null }
export interface StateUT {
  id: string; slug: string; name: string; kind: 'state' | 'ut'; region_id: string; capital: string | null; description: string | null;
  latitude: number | null; longitude: number | null; tourism_url: string | null; tourism_url_status: 'verified' | 'unverified'; sort_order: number;
}
export interface Circuit {
  id: string; slug: string; name: string; description: string | null; region_id: string | null; days: number; categories: string[]; best_months: number[];
  circuit_stops?: { stop_order: number; nights: number; destinations: Pick<Destination, 'id' | 'name' | 'state' | 'categories' | 'hero_image' | 'latitude' | 'longitude' | 'recommended_days'> }[];
}
export interface SearchFilters {
  q?: string; region?: string | null; state?: string | null; category?: string | null; month?: number | null;
  maxDays?: number | null; tier?: string | null; type?: string | null;
}

export interface Attraction {
  id: string;
  destination_id: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_cost: number;
  duration_minutes: number;
  opening_time: string | null;
  closing_time: string | null;
  image: string | null;
  rating: number | null;
  status: 'draft' | 'published' | 'archived';
  significance?: string | null;
  entry_fee_text?: string | null;
  timings_text?: string | null;
  closed_days?: number[];
  dress_code?: string | null;
  photography?: string | null;
  booking_url?: string | null;
  source_url?: string | null;
  last_verified?: string | null;
  unesco?: boolean;
  verification_status?: VerificationStatus;
}

export interface RequirementDoc {
  id: string;
  destination_id: string;
  document_name?: string;
  permit_name?: string;
  description: string | null;
  required: boolean;
  applicable_to: string | null;
  cost?: string | null;
  processing_time?: string | null;
  source: string | null;
  source_url: string | null;
  source_type: Source;
  last_verified: string | null;
  review_date: string | null;
  status: ReviewStatus;
  state_id?: string | null;
  mandatory?: boolean;
  reconfirm_note?: string | null;
}

export interface Hotel {
  id: string; destination_id: string; name: string; image: string | null; price_range: string | null;
  rating: number | null; location: string | null; amenities: string[]; booking_url: string | null;
  latitude: number | null; longitude: number | null; status: string;
}
export interface Experience {
  id: string; destination_id: string; name: string; category: string | null; description: string | null;
  price: number | null; duration_minutes: number | null; location: string | null; rating: number | null;
  booking_url: string | null; status: string;
}

export interface Trip {
  id: string;
  user_id: string;
  destination_id: string;
  title: string | null;
  origin: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  travellers: number;
  traveller_type: string | null;
  budget: number;
  travel_mode: string;
  status: 'planning' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  hotel_confirmed: boolean;
  transport_planned: boolean;
  adults?: number | null;
  children?: number | null;
  pace?: 'relaxed' | 'moderate' | 'packed' | null;
  interests?: string[];
  dietary?: string | null;
  accessibility_needs?: string | null;
  accommodation_pref?: string | null;
  travel_style?: 'budget' | 'standard' | 'premium' | null;
  destinations?: Pick<Destination, 'id' | 'name' | 'state' | 'categories' | 'hero_image' | 'latitude' | 'longitude'>;
}

export interface ItineraryItem {
  id: string;
  itinerary_id: string;
  trip_id: string;
  attraction_id: string | null;
  day_number: number;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  activity: string;
  description: string | null;
  estimated_cost: number;
  travel_time_minutes: number | null;
  notes: string | null;
  sort_order: number;
  latitude: number | null;
  longitude: number | null;
  source: 'manual' | 'rule' | 'ai';
}

export interface BudgetCategory { id: string; trip_id: string; category: string; estimated_amount: number }
export interface Expense { id: string; trip_id: string; category: string; amount: number; expense_date: string; note: string | null }
export interface ChecklistItem {
  id: string; trip_id: string; task: string; category: string; due_date: string | null; completed: boolean;
  priority: 'high' | 'medium' | 'low';
}
export interface AppNotification {
  id: string; user_id: string; type: string; title: string; body: string | null; data: Record<string, any>;
  read: boolean; created_at: string;
}
