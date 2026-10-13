import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/AuthProvider';
import type {
  AppNotification, Attraction, BudgetCategory, ChecklistItem, Destination, Expense, Experience, Hotel,
  ItineraryItem, RequirementDoc, Trip,
} from '../lib/types';
import { todayISO } from '../lib/format';

function check<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ---------------- destinations ---------------- */
export const useDestinations = (opts: { category?: string | null; search?: string; limit?: number } = {}) =>
  useQuery({
    queryKey: ['destinations', opts],
    queryFn: async () => {
      let q = supabase.from('destinations').select('*').eq('status', 'published');
      if (opts.category) q = q.contains('categories', [opts.category]);
      if (opts.search?.trim()) {
        const s = opts.search.trim().replace(/[%,()]/g, ' ');
        q = q.or(`name.ilike.%${s}%,state.ilike.%${s}%,country.ilike.%${s}%,tagline.ilike.%${s}%`);
      }
      q = q.order('popularity', { ascending: false });
      if (opts.limit) q = q.limit(opts.limit);
      return check(await q) as Destination[];
    },
  });

export const useDestination = (id?: string) =>
  useQuery({
    queryKey: ['destination', id],
    enabled: !!id,
    queryFn: async () => check(await supabase.from('destinations').select('*').eq('id', id!).maybeSingle()) as Destination | null,
  });

export const useAttractions = (destinationId?: string) =>
  useQuery({
    queryKey: ['attractions', destinationId],
    enabled: !!destinationId,
    queryFn: async () =>
      check(await supabase.from('attractions').select('*').eq('destination_id', destinationId!).eq('status', 'published').order('rating', { ascending: false, nullsFirst: false })) as Attraction[],
  });

export const useAttraction = (id?: string) =>
  useQuery({
    queryKey: ['attraction', id],
    enabled: !!id,
    queryFn: async () => check(await supabase.from('attractions').select('*, destinations(id,name,state)').eq('id', id!).maybeSingle()) as (Attraction & { destinations: { id: string; name: string; state: string } }) | null,
  });

/** Documents + permits for a destination, including state/UT-wide rules such as an Inner Line Permit. */
export const useRequirements = (destinationId?: string, stateId?: string | null) =>
  useQuery({
    queryKey: ['requirements', destinationId, stateId ?? null],
    enabled: !!destinationId,
    queryFn: async () => {
      const permitQ = stateId
        ? supabase.from('permits').select('*').or(`destination_id.eq.${destinationId},and(state_id.eq.${stateId},destination_id.is.null)`)
        : supabase.from('permits').select('*').eq('destination_id', destinationId!);
      const [d, p] = await Promise.all([
        supabase.from('documents').select('*').eq('destination_id', destinationId!).order('required', { ascending: false }),
        permitQ.order('required', { ascending: false }),
      ]);
      return { documents: check(d) as RequirementDoc[], permits: check(p) as RequirementDoc[] };
    },
  });

export const useHotels = (destinationId?: string) =>
  useQuery({
    queryKey: ['hotels', destinationId], enabled: !!destinationId,
    queryFn: async () => check(await supabase.from('hotels').select('*').eq('destination_id', destinationId!).eq('status', 'published')) as Hotel[],
  });
export const useExperiences = (destinationId?: string) =>
  useQuery({
    queryKey: ['experiences', destinationId], enabled: !!destinationId,
    queryFn: async () => check(await supabase.from('experiences').select('*').eq('destination_id', destinationId!).eq('status', 'published')) as Experience[],
  });

/* ---------------- trips ---------------- */
const TRIP_SELECT = '*, destinations(id,name,state,categories,hero_image,latitude,longitude)';

export const useTrips = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trips', user?.id],
    enabled: !!user,
    queryFn: async () => check(await supabase.from('trips').select(TRIP_SELECT).order('start_date', { ascending: true })) as Trip[],
  });
};

export const useTrip = (id?: string) =>
  useQuery({
    queryKey: ['trip', id],
    enabled: !!id,
    queryFn: async () => check(await supabase.from('trips').select(TRIP_SELECT).eq('id', id!).maybeSingle()) as Trip | null,
  });

export const useItinerary = (tripId?: string) =>
  useQuery({
    queryKey: ['itinerary', tripId],
    enabled: !!tripId,
    queryFn: async () =>
      check(await supabase.from('itinerary_items').select('*').eq('trip_id', tripId!).order('day_number').order('sort_order').order('start_time')) as ItineraryItem[],
  });

export const useBudget = (tripId?: string) =>
  useQuery({
    queryKey: ['budget', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const [c, e] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('trip_id', tripId!).order('estimated_amount', { ascending: false }),
        supabase.from('expenses').select('*').eq('trip_id', tripId!).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      return { categories: check(c) as BudgetCategory[], expenses: check(e) as Expense[] };
    },
  });

export const useChecklist = (tripId?: string) =>
  useQuery({
    queryKey: ['checklist', tripId],
    enabled: !!tripId,
    queryFn: async () =>
      check(await supabase.from('checklist_items').select('*').eq('trip_id', tripId!).order('completed').order('due_date', { nullsFirst: false }).order('created_at')) as ChecklistItem[],
  });

export function readiness(trip: Trip, items: ChecklistItem[] | undefined, itinCount: number) {
  const list = items ?? [];
  const ratio = list.length ? list.filter((i) => i.completed).length / list.length : 0;
  const docs = list.filter((i) => i.category === 'Documents' || i.category === 'Permits');
  const docRatio = docs.length ? docs.filter((i) => i.completed).length / docs.length : 1;
  const score = 0.35 * ratio + 0.2 * (itinCount > 0 ? 1 : 0) + 0.15 * (trip.hotel_confirmed ? 1 : 0) + 0.15 * (trip.transport_planned ? 1 : 0) + 0.15 * docRatio;
  return Math.round(score * 100);
}

/* ---------------- saved ---------------- */
export const useSaved = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['saved', user?.id],
    enabled: !!user,
    queryFn: async () => check(await supabase.from('saved_items').select('*').order('created_at', { ascending: false })) as { id: string; item_type: 'destination' | 'attraction' | 'hotel' | 'experience'; item_id: string }[],
  });
};

export function useToggleSave() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: saved } = useSaved();
  return {
    isSaved: (type: string, id: string) => !!saved?.some((s) => s.item_type === type && s.item_id === id),
    toggle: async (type: 'destination' | 'attraction' | 'hotel' | 'experience', id: string) => {
      if (!user) return;
      const existing = saved?.find((s) => s.item_type === type && s.item_id === id);
      if (existing) check(await supabase.from('saved_items').delete().eq('id', existing.id).select());
      else check(await supabase.from('saved_items').insert({ user_id: user.id, item_type: type, item_id: id }).select());
      await qc.invalidateQueries({ queryKey: ['saved'] });
      return !existing;
    },
  };
}

/* ---------------- notifications ---------------- */
export const useNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => check(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as AppNotification[],
  });
};

export const useRecentSearches = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recent_searches', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = check(await supabase.from('recent_searches').select('query,created_at').order('created_at', { ascending: false }).limit(20)) as { query: string }[];
      return Array.from(new Set(rows.map((r) => r.query))).slice(0, 6);
    },
  });
};

/* ---------------- mutations ---------------- */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export const upcoming = (t: Trip) => t.status !== 'completed' && t.status !== 'cancelled' && t.end_date >= todayISO();

export { useMutation };
