import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import type { Circuit, Destination, Region, RequirementDoc, SearchFilters, StateUT } from '../lib/types';

function check<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const PAGE = 20;
const HOUR = 60 * 60 * 1000;

export const useRegions = () =>
  useQuery({
    queryKey: ['regions'], staleTime: HOUR,
    queryFn: async () => check(await supabase.from('regions').select('*').order('sort_order')) as Region[],
  });

export const useStates = () =>
  useQuery({
    queryKey: ['states'], staleTime: HOUR,
    queryFn: async () => check(await supabase.from('states').select('*').order('sort_order')) as StateUT[],
  });

export const useStateUT = (idOrSlug?: string) =>
  useQuery({
    queryKey: ['state', idOrSlug], enabled: !!idOrSlug, staleTime: HOUR,
    queryFn: async () => {
      const col = idOrSlug!.length <= 3 ? 'id' : 'slug';
      return check(await supabase.from('states').select('*').eq(col, col === 'id' ? idOrSlug!.toUpperCase() : idOrSlug!).maybeSingle()) as StateUT | null;
    },
  });

/** Server-side filtered, paginated search (never loads the whole catalogue). */
export const useSearchDestinations = (f: SearchFilters, enabled = true) =>
  useInfiniteQuery({
    queryKey: ['search_destinations', f],
    enabled,
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ pageParam }) => {
      const r = check(await supabase.rpc('search_destinations', {
        p_q: f.q?.trim() || null, p_region: f.region ?? null, p_state: f.state ?? null, p_category: f.category ?? null,
        p_month: f.month ?? null, p_max_days: f.maxDays ?? null, p_tier: f.tier ?? null, p_type: f.type ?? null,
        p_limit: PAGE, p_offset: pageParam,
      })) as { total: number; items: Destination[] };
      return { ...r, offset: pageParam as number };
    },
    getNextPageParam: (last) => (last.offset + last.items.length < last.total ? last.offset + PAGE : undefined),
  });

export const useNearby = (lat?: number | null, lng?: number | null, radiusKm = 150, exclude?: string, limit = 10) =>
  useQuery({
    queryKey: ['nearby', lat, lng, radiusKm, exclude, limit],
    enabled: lat != null && lng != null,
    staleTime: HOUR,
    queryFn: async () => check(await supabase.rpc('nearby_destinations', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_limit: limit, p_exclude: exclude ?? null })) as Destination[],
  });

export const useStatePermits = (stateId?: string | null) =>
  useQuery({
    queryKey: ['state_permits', stateId], enabled: !!stateId, staleTime: HOUR,
    queryFn: async () => check(await supabase.from('permits').select('*').eq('state_id', stateId!).is('destination_id', null).order('mandatory', { ascending: false })) as RequirementDoc[],
  });

const CIRCUIT_SELECT = '*, circuit_stops(stop_order, nights, destinations(id,name,state,categories,hero_image,latitude,longitude,recommended_days))';
export const useCircuits = (region?: string | null) =>
  useQuery({
    queryKey: ['circuits', region], staleTime: HOUR,
    queryFn: async () => {
      let q = supabase.from('travel_circuits').select(CIRCUIT_SELECT).eq('status', 'published').order('days');
      if (region) q = q.eq('region_id', region);
      const rows = check(await q) as Circuit[];
      rows.forEach((c) => c.circuit_stops?.sort((a, b) => a.stop_order - b.stop_order));
      return rows;
    },
  });
export const useCircuit = (slug?: string) =>
  useQuery({
    queryKey: ['circuit', slug], enabled: !!slug, staleTime: HOUR,
    queryFn: async () => {
      const c = check(await supabase.from('travel_circuits').select(CIRCUIT_SELECT).eq('slug', slug!).maybeSingle()) as Circuit | null;
      c?.circuit_stops?.sort((a, b) => a.stop_order - b.stop_order);
      return c;
    },
  });

export const useDestinationsByIds = (ids: string[]) =>
  useQuery({
    queryKey: ['destinations_by_ids', ids], enabled: ids.length > 0,
    queryFn: async () => {
      const rows = check(await supabase.from('destinations').select('*').in('id', ids)) as Destination[];
      return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Destination[];
    },
  });

/* ---------- compare selection (tiny in-memory store, max 3) ---------- */
const COMPARE_KEY = 'travelos.compare';
let compareIds: string[] = (() => {
  try { const v = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(COMPARE_KEY) : null; return v ? (JSON.parse(v) as string[]).slice(0, 3) : []; } catch { return []; }
})();
const listeners = new Set<() => void>();
const emit = () => {
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
};
export const compareStore = {
  toggle(id: string) {
    compareIds = compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id].slice(-3);
    emit();
    return compareIds.includes(id);
  },
  clear() { compareIds = []; emit(); },
};
export const useCompare = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => compareIds, () => compareIds);

/* ---------- budget model (indicative, documented assumptions) ---------- */
export type Style = 'budget' | 'standard' | 'premium';
export const BUDGET_ASSUMPTIONS: Record<Style, { stayPerRoomNight: number; foodPerDay: number; localPerDay: number; ticketsPerDay: number; activitiesPerDay: number; shoppingPerDay: number }> = {
  // INR, per adult unless noted. Planning estimates only — not live prices.
  budget: { stayPerRoomNight: 1500, foodPerDay: 600, localPerDay: 400, ticketsPerDay: 200, activitiesPerDay: 300, shoppingPerDay: 200 },
  standard: { stayPerRoomNight: 4000, foodPerDay: 1200, localPerDay: 900, ticketsPerDay: 400, activitiesPerDay: 800, shoppingPerDay: 500 },
  premium: { stayPerRoomNight: 12000, foodPerDay: 3000, localPerDay: 2500, ticketsPerDay: 800, activitiesPerDay: 2500, shoppingPerDay: 1500 },
};
export const CHILD_FACTOR = 0.5; // children cost about half for food, tickets and activities
export const CONTINGENCY = 0.1;

export interface BudgetLine { key: string; label: string; amount: number; note: string }
export function estimateBudget(o: { adults: number; children: number; days: number; style: Style; transportPerPerson: number; permitsTotal: number }) {
  const a = BUDGET_ASSUMPTIONS[o.style];
  const nights = Math.max(o.days - 1, 0);
  const people = o.adults + o.children * CHILD_FACTOR;
  const rooms = Math.max(1, Math.ceil((o.adults + o.children * 0.5) / 2));
  const lines: BudgetLine[] = [
    { key: 'Transportation', label: 'Transport to & from', amount: o.transportPerPerson * (o.adults + o.children), note: 'Your estimate per person, return' },
    { key: 'Accommodation', label: 'Accommodation', amount: a.stayPerRoomNight * rooms * nights, note: `${rooms} room${rooms > 1 ? 's' : ''} × ${nights} night${nights === 1 ? '' : 's'}` },
    { key: 'Food', label: 'Food', amount: Math.round(a.foodPerDay * people * o.days), note: 'Per adult per day; children at half' },
    { key: 'Local transport', label: 'Local transport', amount: Math.round(a.localPerDay * people * o.days), note: 'Autos, taxis, local buses' },
    { key: 'Activities', label: 'Attraction tickets & activities', amount: Math.round((a.ticketsPerDay + a.activitiesPerDay) * people * o.days), note: 'Tickets are indicative — check official prices' },
    { key: 'Permits', label: 'Permits', amount: o.permitsTotal, note: 'Enter official fees if your route needs permits' },
    { key: 'Shopping', label: 'Shopping & miscellaneous', amount: Math.round(a.shoppingPerDay * (o.adults + o.children * 0.5) * o.days), note: 'Souvenirs, tips, small extras' },
  ];
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  lines.push({ key: 'Miscellaneous', label: 'Contingency (10%)', amount: Math.round(subtotal * CONTINGENCY), note: 'Buffer for surprises' });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const headcount = Math.max(o.adults + o.children, 1);
  return { lines, total, perPerson: Math.round(total / headcount) };
}
