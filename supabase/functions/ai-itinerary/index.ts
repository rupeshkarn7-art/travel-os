// Travel OS · AI itinerary (Anthropic Claude)
// Grounded planner: the model may only use places from the Travel OS catalogue (by id).
// Server-side validation rejects unknown places, duplicate visits, days outside the trip,
// visits on known closing days and times outside known opening hours.
// Secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional, default claude-sonnet-5-5).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'AI planner is not configured yet. Use the standard suggested plan for now.' }, 503);
    const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';

    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return json({ error: 'Not signed in' }, 401);

    const { trip_id, day } = await req.json().catch(() => ({}));
    if (!trip_id || typeof trip_id !== 'string') return json({ error: 'trip_id required' }, 400);
    const onlyDay = Number.isInteger(day) ? Number(day) : null;   // regenerate a single day

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await sb.from('ai_requests').select('id', { count: 'exact', head: true }).gte('created_at', since);
    if ((count ?? 0) >= 10) return json({ error: 'Daily AI limit reached. Try again tomorrow.' }, 429);

    const { data: trip } = await sb.from('trips').select('*, destinations(*)').eq('id', trip_id).maybeSingle();
    if (!trip) return json({ error: 'Trip not found' }, 404);
    const dest = trip.destinations;
    const { data: places } = await sb.from('attractions')
      .select('id,name,category,description,duration_minutes,latitude,longitude,opening_time,closing_time,closed_days,timings_text,entry_fee_text,unesco')
      .eq('destination_id', trip.destination_id).eq('status', 'published');
    if (!places?.length) return json({ error: 'No places are available for this destination yet' }, 422);
    const { data: permits } = await sb.from('permits').select('permit_name,mandatory,status,source_url')
      .or(`destination_id.eq.${trip.destination_id},and(state_id.eq.${dest.state_id},destination_id.is.null)`);

    const { data: itin } = await sb.from('itineraries').select('id').eq('trip_id', trip_id).order('created_at').limit(1).maybeSingle();
    if (!itin) return json({ error: 'Itinerary not found' }, 404);

    const days = Array.from({ length: trip.duration_days }, (_, i) => {
      const d = new Date(trip.start_date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
      return { day: i + 1, date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
    });
    const month = Number(String(trip.start_date).slice(5, 7));
    const context = {
      destination: { name: dest.name, state: dest.state, best_months: dest.best_months, highlights: dest.highlights, food: dest.food,
        in_best_season: dest.best_months?.length ? dest.best_months.includes(month) : null },
      trip: { days, travellers: trip.travellers, adults: trip.adults, children: trip.children, traveller_type: trip.traveller_type,
        total_budget_inr: trip.budget, pace: trip.pace ?? 'moderate', interests: trip.interests ?? [], travel_style: trip.travel_style,
        dietary: trip.dietary, accessibility_needs: trip.accessibility_needs, accommodation_pref: trip.accommodation_pref },
      places: places.map((p) => ({ id: p.id, name: p.name, category: p.category, minutes: p.duration_minutes,
        lat: p.latitude, lng: p.longitude, opens: p.opening_time, closes: p.closing_time, closed_weekdays: p.closed_days,
        hours_verified: !!p.timings_text, fee_verified: !!p.entry_fee_text })),
      permits: (permits ?? []).map((p) => ({ name: p.permit_name, mandatory: p.mandatory, verified: p.status === 'verified' })),
      regenerate_only_day: onlyDay,
    };
    const perDay = trip.pace === 'relaxed' ? '2' : trip.pace === 'packed' ? '3-4' : '2-3';
    const system = [
      'You are the Travel OS trip planner for India. Plan a practical day-by-day itinerary.',
      'Rules:',
      '- Use ONLY places from the provided list, referenced by their id. Never invent places, prices, opening hours, permits, travel times or rules.',
      `- ${perDay} places per day; group nearby places (use lat/lng) and order them geographically.`,
      '- Never schedule a place on a weekday listed in closed_weekdays (0=Sunday). If opens/closes are given, start within those hours.',
      '- Start times between 07:00 and 19:00. Each place at most once. Respect interests, pace, children and accessibility needs.',
      '- If a fact is missing (hours_verified=false, unknown travel time), say so briefly in the note instead of guessing.',
      '- Add one short bad-weather or closure alternative per day when possible, as a note.',
      'Return ONLY JSON: {"items":[{"day":int,"place_id":string,"start":"HH:MM","note":string}],"day_notes":[{"day":int,"note":string}]}',
    ].join('\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4000, temperature: 0.3, system, messages: [{ role: 'user', content: JSON.stringify(context) }] }),
    });
    if (!res.ok) {
      await sb.from('ai_requests').insert({ user_id: u.user.id, trip_id, status: 'failed', model, prompt_version: 'v2-anthropic', error: `HTTP ${res.status}` });
      return json({ error: 'AI provider error. Please try again later.' }, 502);
    }
    const out = await res.json();
    const text: string = (out.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    let parsed: any;
    try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return json({ error: 'AI returned invalid output' }, 502); }

    const byId = new Map(places.map((p) => [p.id, p]));
    const seen = new Set<string>();
    if (onlyDay) {
      // places already used on other days stay unique
      const { data: other } = await sb.from('itinerary_items').select('attraction_id').eq('trip_id', trip_id).neq('day_number', onlyDay);
      (other ?? []).forEach((o) => o.attraction_id && seen.add(o.attraction_id));
    }
    const rows: any[] = [];
    const order: Record<number, number> = {};
    let rejected = 0;
    for (const it of Array.isArray(parsed.items) ? parsed.items : []) {
      const p = byId.get(it?.place_id);
      const dn = Number(it?.day);
      if (!p || seen.has(p.id) || !Number.isInteger(dn) || dn < 1 || dn > trip.duration_days || (onlyDay && dn !== onlyDay)) { rejected++; continue; }
      const dinfo = days[dn - 1];
      if (Array.isArray(p.closed_days) && p.closed_days.includes(dinfo.weekday)) { rejected++; continue; }
      let start = /^([01]\d|2[0-3]):[0-5]\d$/.test(it.start) ? it.start : '10:00';
      if (p.opening_time && p.closing_time) {
        const o = toMin(p.opening_time), c = toMin(p.closing_time);
        if (toMin(start) < o) start = toHHMM(o);
        if (toMin(start) >= c) { rejected++; continue; }
      }
      seen.add(p.id);
      const endM = toMin(start) + (p.duration_minutes || 90);
      order[dn] = (order[dn] ?? 0) + 1;
      let note = typeof it.note === 'string' ? it.note.slice(0, 300) : (p.description ?? '');
      if (!p.timings_text && !/hour/i.test(note)) note = `${note} Opening hours not verified — check before visiting.`.trim();
      rows.push({
        itinerary_id: itin.id, trip_id, attraction_id: p.id, day_number: dn, date: dinfo.date, start_time: start, end_time: endM < 1440 ? toHHMM(endM) : null,
        place: p.name, activity: `Visit ${p.name}`, description: note, estimated_cost: 0, latitude: p.latitude, longitude: p.longitude,
        sort_order: order[dn], source: 'ai',
      });
    }
    for (const dnote of Array.isArray(parsed.day_notes) ? parsed.day_notes : []) {
      const dn = Number(dnote?.day);
      if (!Number.isInteger(dn) || dn < 1 || dn > trip.duration_days || (onlyDay && dn !== onlyDay) || typeof dnote.note !== 'string') continue;
      rows.push({ itinerary_id: itin.id, trip_id, day_number: dn, date: days[dn - 1].date, start_time: '19:30', end_time: '20:00',
        activity: 'Planner note', description: dnote.note.slice(0, 300), sort_order: 90, source: 'ai' });
    }
    if (rows.filter((r) => r.attraction_id).length < (onlyDay ? 1 : 2)) return json({ error: 'AI returned an unusable plan. Try the standard plan.' }, 502);

    if (onlyDay) {
      const del = await sb.from('itinerary_items').delete().eq('trip_id', trip_id).eq('day_number', onlyDay).neq('source', 'manual');
      if (del.error) return json({ error: del.error.message }, 500);
    }
    const ins = await sb.from('itinerary_items').insert(rows);
    if (ins.error) return json({ error: ins.error.message }, 500);
    await sb.from('ai_requests').insert({ user_id: u.user.id, trip_id, status: 'succeeded', model, prompt_version: 'v2-anthropic' });
    return json({ ok: true, count: rows.length, rejected });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
