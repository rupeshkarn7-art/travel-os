-- Travel OS · 006 catalogue functions
-- Importer (idempotent), search with filters + pagination, nearby search, catalogue audit,
-- and smarter itinerary/trip functions that use the catalogue. Safe to run more than once.

create extension if not exists http with schema extensions;

-- ---------------------------------------------------------------------------
-- Importer: upserts regions, states, destinations, attractions, permits, circuits from JSON.
-- Usage (SQL editor):  select public.import_india_catalogue_from_url('https://raw.githubusercontent.com/rupeshkarn7-art/travel-os/main/data/india/out/catalogue.json');
-- ---------------------------------------------------------------------------
create or replace function public.import_india_catalogue(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare n_d int; n_a int; n_p int; n_c int; missing int;
begin
  insert into regions (id, name, sort_order, description)
  select x.id, x.name, x.sort_order, x.description from jsonb_to_recordset(p->'regions') as x(id text, name text, sort_order int, description text)
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, description = excluded.description;

  insert into states (id, slug, name, kind, region_id, capital, latitude, longitude, tourism_url, description, sort_order)
  select x.id, x.slug, x.name, x.kind, x.region_id, x.capital, x.latitude, x.longitude, x.tourism_url, x.description, x.sort_order
  from jsonb_to_recordset(p->'states') as x(id text, slug text, name text, kind text, region_id text, capital text, latitude float8, longitude float8,
                                            tourism_url text, description text, sort_order int)
  on conflict (id) do update set slug = excluded.slug, name = excluded.name, kind = excluded.kind, region_id = excluded.region_id, capital = excluded.capital,
    latitude = excluded.latitude, longitude = excluded.longitude, tourism_url = excluded.tourism_url, description = excluded.description, sort_order = excluded.sort_order;

  insert into destinations (slug, name, state, country, categories, tagline, description, recommended_days, budget_min, budget_max, latitude, longitude,
    popularity, status, source_type, source_url, state_id, district, destination_type, alt_names, best_months, highlights, hidden_gems, food,
    nearest_airport, nearest_railway, budget_tier, unesco, source_org, verification_status, completeness, missing_fields, season_notes, transportation)
  select x.slug, x.name, x.state, x.country, x.categories, x.tagline, x.description, x.recommended_days, x.budget_min, x.budget_max, x.latitude, x.longitude,
    x.popularity, x.status, x.source_type, x.source_url, x.state_id, x.district, x.destination_type, x.alt_names, x.best_months, x.highlights, x.hidden_gems, x.food,
    x.nearest_airport, x.nearest_railway, x.budget_tier, x.unesco, x.source_org, x.verification_status, x.completeness, x.missing_fields, x.season_notes, x.transportation
  from jsonb_to_recordset(p->'destinations') as x(slug text, name text, state text, country text, categories text[], tagline text, description text,
    recommended_days int, budget_min int, budget_max int, latitude float8, longitude float8, popularity int, status text, source_type text, source_url text,
    state_id text, district text, destination_type text, alt_names text[], best_months int[], highlights text[], hidden_gems text[], food text[],
    nearest_airport text, nearest_railway text, budget_tier text, unesco bool, source_org text, verification_status text, completeness int,
    missing_fields text[], season_notes text, transportation text)
  on conflict (slug) do update set name = excluded.name, state = excluded.state, categories = excluded.categories, tagline = excluded.tagline,
    description = excluded.description, recommended_days = excluded.recommended_days, budget_min = excluded.budget_min, budget_max = excluded.budget_max,
    latitude = excluded.latitude, longitude = excluded.longitude, popularity = excluded.popularity, source_type = excluded.source_type,
    source_url = excluded.source_url, state_id = excluded.state_id, district = excluded.district, destination_type = excluded.destination_type,
    alt_names = excluded.alt_names, best_months = excluded.best_months, highlights = excluded.highlights, hidden_gems = excluded.hidden_gems,
    food = excluded.food, nearest_airport = excluded.nearest_airport, nearest_railway = excluded.nearest_railway, budget_tier = excluded.budget_tier,
    unesco = excluded.unesco, source_org = excluded.source_org, verification_status = excluded.verification_status, completeness = excluded.completeness,
    missing_fields = excluded.missing_fields, season_notes = excluded.season_notes,
    transportation = coalesce(destinations.transportation, excluded.transportation), updated_at = now();
  get diagnostics n_d = row_count;

  -- give pre-existing attractions a slug so they merge instead of duplicating
  update attractions set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) where slug is null;

  select count(*) into missing from jsonb_to_recordset(p->'attractions') as x(destination_slug text)
  where not exists (select 1 from destinations d where d.slug = x.destination_slug);
  if missing > 0 then raise exception '% attractions reference unknown destinations', missing; end if;

  insert into attractions (destination_id, slug, name, category, description, latitude, longitude, estimated_cost, duration_minutes, status, unesco,
    source_org, verification_status, source_url)
  select d.id, x.slug, x.name, x.category, x.description, x.latitude, x.longitude, 0, x.duration_minutes, 'published', x.unesco, x.source_org,
    x.verification_status, x.source_url
  from jsonb_to_recordset(p->'attractions') as x(destination_slug text, slug text, name text, category text, description text, latitude float8, longitude float8,
    duration_minutes int, unesco bool, source_org text, verification_status text, source_url text)
  join destinations d on d.slug = x.destination_slug
  on conflict (destination_id, slug) do update set name = excluded.name, category = excluded.category, description = excluded.description,
    latitude = excluded.latitude, longitude = excluded.longitude, duration_minutes = excluded.duration_minutes, unesco = excluded.unesco,
    source_org = excluded.source_org, verification_status = excluded.verification_status, source_url = coalesce(excluded.source_url, attractions.source_url);
  get diagnostics n_a = row_count;

  insert into permits (slug, destination_id, state_id, permit_name, description, required, mandatory, applicable_to, source, source_url, source_type,
    last_verified, status, reconfirm_note)
  select x.slug,
    case when x.scope = 'dest' then (select id from destinations where slug = x.ref) end,
    case when x.scope = 'state' then x.ref else (select state_id from destinations where slug = x.ref) end,
    x.permit_name, x.description, x.mandatory, x.mandatory, x.applicable_to, x.source, x.source_url, x.source_type, x.last_verified, x.status, x.reconfirm_note
  from jsonb_to_recordset(p->'permits') as x(slug text, scope text, ref text, permit_name text, description text, applicable_to text, mandatory bool,
    status text, source text, source_url text, source_type text, last_verified date, reconfirm_note text)
  on conflict (slug) do update set destination_id = excluded.destination_id, state_id = excluded.state_id, permit_name = excluded.permit_name,
    description = excluded.description, required = excluded.required, mandatory = excluded.mandatory, applicable_to = excluded.applicable_to,
    source = excluded.source, source_url = excluded.source_url, source_type = excluded.source_type, last_verified = excluded.last_verified,
    status = excluded.status, reconfirm_note = excluded.reconfirm_note;
  get diagnostics n_p = row_count;

  insert into travel_circuits (slug, name, region_id, days, categories, best_months, description)
  select x.slug, x.name, x.region_id, x.days, x.categories, x.best_months, x.description
  from jsonb_to_recordset(p->'circuits') as x(slug text, name text, region_id text, days int, categories text[], best_months int[], description text)
  on conflict (slug) do update set name = excluded.name, region_id = excluded.region_id, days = excluded.days, categories = excluded.categories,
    best_months = excluded.best_months, description = excluded.description;
  get diagnostics n_c = row_count;

  delete from circuit_stops cs using travel_circuits c
  where cs.circuit_id = c.id and c.slug in (select x.slug from jsonb_to_recordset(p->'circuits') as x(slug text));
  insert into circuit_stops (circuit_id, destination_id, stop_order, nights)
  select c.id, d.id, s.ord, (s.stop->>'nights')::int
  from jsonb_to_recordset(p->'circuits') as x(slug text, stops jsonb)
  join travel_circuits c on c.slug = x.slug
  cross join lateral jsonb_array_elements(x.stops) with ordinality as s(stop, ord)
  join destinations d on d.slug = s.stop->>'destination_slug';

  return jsonb_build_object('destinations', n_d, 'attractions', n_a, 'permits', n_p, 'circuits', n_c, 'version', p->>'version');
end $$;

create or replace function public.import_india_catalogue_from_url(p_url text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r extensions.http_response;
begin
  select * into r from extensions.http_get(p_url);
  if r.status <> 200 then raise exception 'Download failed (HTTP %)', r.status; end if;
  return public.import_india_catalogue(r.content::jsonb);
end $$;

revoke all on function public.import_india_catalogue(jsonb) from public, anon, authenticated;
revoke all on function public.import_india_catalogue_from_url(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Search with filters and pagination (server-side; never loads the whole catalogue)
-- ---------------------------------------------------------------------------
create or replace function public.search_destinations(
  p_q text default null, p_region text default null, p_state text default null, p_category text default null,
  p_month int default null, p_max_days int default null, p_tier text default null, p_type text default null,
  p_limit int default 20, p_offset int default 0)
returns jsonb language sql stable set search_path = public, extensions as $$
  with base as (
    select d.*, s.name as state_name, s.region_id,
      case when coalesce(trim(p_q), '') = '' then 0
           else greatest(similarity(d.search_text, lower(p_q)), case when d.search_text like '%' || lower(trim(p_q)) || '%' then 0.6 else 0 end,
                         coalesce((select max(similarity(lower(a.name), lower(p_q))) from attractions a where a.destination_id = d.id and a.status = 'published'), 0) * 0.9)
      end as score
    from destinations d left join states s on s.id = d.state_id
    where d.status = 'published'
      and (p_region is null or s.region_id = p_region)
      and (p_state is null or d.state_id = p_state)
      and (p_category is null or p_category = any(d.categories))
      and (p_month is null or cardinality(d.best_months) = 0 or p_month = any(d.best_months))
      and (p_max_days is null or d.recommended_days <= p_max_days)
      and (p_tier is null or d.budget_tier = p_tier)
      and (p_type is null or d.destination_type = p_type)
  ), hits as (
    select * from base where coalesce(trim(p_q), '') = '' or score >= 0.18
  )
  select jsonb_build_object(
    'total', (select count(*) from hits),
    'items', coalesce((select jsonb_agg(to_jsonb(h) - 'search_text' - 'score' order by h.score desc, h.popularity desc, h.name)
                       from (select * from hits order by score desc, popularity desc, name limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)) h), '[]'::jsonb));
$$;

-- Straight-line distance; the app labels it as such (never as road distance)
create or replace function public.nearby_destinations(p_lat float8, p_lng float8, p_radius_km float8 default 300, p_limit int default 20, p_exclude uuid default null)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'distance_km')::float8), '[]'::jsonb) from (
    select to_jsonb(d) - 'search_text' || jsonb_build_object('distance_km', round(km::numeric, 0)) as x
    from (select d.*, 6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - p_lat) / 2), 2)
              + cos(radians(p_lat)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - p_lng) / 2), 2))) as km
          from destinations d where d.status = 'published' and d.latitude is not null and (p_exclude is null or d.id <> p_exclude)) d
    where km <= p_radius_km order by km limit least(greatest(p_limit, 1), 50)) t;
$$;

grant execute on function public.search_destinations(text, text, text, text, int, int, text, text, int, int) to anon, authenticated;
grant execute on function public.nearby_destinations(float8, float8, float8, int, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalogue audit for the admin console
-- ---------------------------------------------------------------------------
create or replace function public.catalogue_audit() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not authorised.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'destinations', (select count(*) from destinations),
    'attractions', (select count(*) from attractions),
    'states_covered', (select count(distinct state_id) from destinations where state_id is not null),
    'unlinked_destinations', (select count(*) from destinations where state_id is null),
    'by_status', (select jsonb_object_agg(verification_status, n) from (select verification_status, count(*) n from destinations group by 1) t),
    'avg_completeness', (select round(avg(completeness)) from destinations),
    'permits_needing_review', (select count(*) from permits where status <> 'verified'),
    'permits_stale', (select count(*) from permits where status = 'verified' and (last_verified is null or last_verified < current_date - 180)),
    'no_attractions', (select count(*) from destinations d where not exists (select 1 from attractions a where a.destination_id = d.id)),
    'missing_coordinates', (select count(*) from attractions where latitude is null),
    'possible_duplicates', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'state', state_id, 'count', n)), '[]'::jsonb)
                            from (select lower(name) name, state_id, count(*) n from destinations group by 1, 2 having count(*) > 1) t),
    'per_state', (select jsonb_agg(jsonb_build_object('state', s.name, 'destinations', (select count(*) from destinations d where d.state_id = s.id)) order by s.sort_order) from states s)
  );
end $$;
revoke all on function public.catalogue_audit() from public, anon;
grant execute on function public.catalogue_audit() to authenticated;

-- ---------------------------------------------------------------------------
-- Trip creation: also add state-level permits (e.g. Inner Line Permit) to the checklist
-- ---------------------------------------------------------------------------
create or replace function public.add_catalogue_checklist(p_trip_id uuid) returns int
language plpgsql security invoker set search_path = public as $$
declare t trips%rowtype; v_state text; n int := 0;
begin
  select * into t from trips where id = p_trip_id and user_id = (select auth.uid());
  if not found then raise exception 'Trip not found.'; end if;
  select state_id into v_state from destinations where id = t.destination_id;
  insert into checklist_items (trip_id, task, category, due_date, priority)
  select t.id, case when p.mandatory then 'Apply / verify permit: ' else 'Recommended: ' end || p.permit_name, 'Permits',
         greatest(current_date, t.start_date - 14), case when p.mandatory then 'high' else 'medium' end
  from permits p
  where (p.state_id = v_state and p.destination_id is null)
    and not exists (select 1 from checklist_items c where c.trip_id = t.id and c.task like '%' || p.permit_name);
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.add_catalogue_checklist(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Itinerary generator v2: pace, geographic ordering (nearest-neighbour), known closing days,
-- opening hours when known, and honest placeholders when data is missing.
-- ---------------------------------------------------------------------------
create or replace function public.generate_itinerary(p_trip_id uuid)
returns integer language plpgsql set search_path = public as $$
declare
  t trips%rowtype; dst destinations%rowtype; v_it uuid; v_days int; d int; v_date date; v_ord int;
  v_per_day int; v_slots time[]; v_slot time; v_meal numeric; v_food numeric;
  v_used uuid[] := '{}'; cur_lat float8; cur_lng float8; a attractions%rowtype; v_dur int; v_end time; v_note text;
begin
  select * into t from trips where id = p_trip_id and user_id = (select auth.uid());
  if not found then raise exception 'Trip not found.'; end if;
  select * into dst from destinations where id = t.destination_id;

  select id into v_it from itineraries where trip_id = p_trip_id order by created_at limit 1;
  if v_it is null then insert into itineraries (trip_id) values (p_trip_id) returning id into v_it; end if;
  if exists (select 1 from itinerary_items where itinerary_id = v_it) then
    raise exception 'Itinerary already has activities. Clear them first to regenerate.';
  end if;

  v_days := t.duration_days;
  v_per_day := case coalesce(t.pace, 'moderate') when 'relaxed' then 2 when 'packed' then 4 else 3 end;
  select coalesce(estimated_amount, 0) into v_food from budget_categories where trip_id = p_trip_id and category = 'Food';
  v_meal := round(coalesce(v_food, 0) / greatest(v_days * 2, 1));

  for d in 1..v_days loop
    v_date := t.start_date + (d - 1);
    v_ord := 0;
    cur_lat := dst.latitude; cur_lng := dst.longitude;   -- start each day from the destination centre (your stay)

    if v_days > 1 and d = 1 then
      v_ord := v_ord + 1;
      insert into itinerary_items (itinerary_id, trip_id, day_number, date, start_time, end_time, activity, description, sort_order, source)
      values (v_it, p_trip_id, d, v_date, '09:00', '11:30', 'Arrival & check-in', 'Reach ' || dst.name || ' and settle in. Travel time depends on your route; it is not estimated here.', v_ord, 'rule');
      v_slots := array['14:30'::time, '17:30'::time];
    elsif v_days > 1 and d = v_days then
      v_slots := array['09:30'::time];
    else
      v_slots := (array['09:30'::time, '12:00'::time, '15:00'::time, '17:30'::time])[1:v_per_day];
    end if;

    foreach v_slot in array v_slots loop
      -- next unvisited attraction, nearest to the current point, not known to be closed on this weekday,
      -- and (if hours are known) open at the slot time
      select x.* into a from attractions x
      where x.destination_id = t.destination_id and x.status = 'published' and not (x.id = any(v_used))
        and not (extract(dow from v_date)::int = any(x.closed_days))
        and (x.opening_time is null or x.closing_time is null or (v_slot >= x.opening_time and v_slot < x.closing_time))
      order by (cardinality(t.interests) > 0 and x.category = any(t.interests)) desc,
               case when x.latitude is null or cur_lat is null then 1e9
                    else power(x.latitude - cur_lat, 2) + power(x.longitude - cur_lng, 2) end,
               x.unesco desc, x.rating desc nulls last, x.name
      limit 1;
      exit when not found;
      v_used := v_used || a.id;
      v_dur := least(coalesce(a.duration_minutes, 90), 240);
      v_end := v_slot + make_interval(mins => v_dur);
      v_note := coalesce(a.description, '');
      if a.timings_text is null then v_note := v_note || ' Opening hours not verified — check before visiting.'; end if;
      v_ord := v_ord + 1;
      insert into itinerary_items (itinerary_id, trip_id, attraction_id, day_number, date, start_time, end_time, place, activity, description,
                                   estimated_cost, latitude, longitude, sort_order, source)
      values (v_it, p_trip_id, a.id, d, v_date, v_slot, v_end, a.name, 'Visit ' || a.name, trim(v_note),
              coalesce(a.estimated_cost, 0) * t.travellers, a.latitude, a.longitude, v_ord, 'rule');
      if a.latitude is not null then cur_lat := a.latitude; cur_lng := a.longitude; end if;
    end loop;

    if v_ord = 0 or (v_days > 1 and d = 1 and v_ord = 1) then
      v_ord := v_ord + 1;
      insert into itinerary_items (itinerary_id, trip_id, day_number, date, start_time, end_time, activity, description, sort_order, source)
      values (v_it, p_trip_id, d, v_date, '10:00', '13:00', 'Explore at your own pace',
              'Not enough verified places to fill this day. Ideas: ' || coalesce(array_to_string(dst.highlights, ', '), 'local markets, viewpoints and food streets') || '.', v_ord, 'rule');
    end if;

    v_ord := v_ord + 1;
    insert into itinerary_items (itinerary_id, trip_id, day_number, date, start_time, end_time, activity, description, estimated_cost, sort_order, source)
    values (v_it, p_trip_id, d, v_date, '13:00', '14:00', 'Lunch',
            'Try local food' || case when cardinality(dst.food) > 0 then ' — e.g. ' || array_to_string(dst.food[1:3], ', ') else '' end || '. Cost is an estimate from your food budget.',
            v_meal, v_ord, 'rule');
    v_ord := v_ord + 1;
    if v_days > 1 and d = v_days then
      insert into itinerary_items (itinerary_id, trip_id, day_number, date, start_time, end_time, activity, description, sort_order, source)
      values (v_it, p_trip_id, d, v_date, '15:00', '16:00', 'Check-out & departure', 'Check out and start your journey back.', v_ord, 'rule');
    else
      insert into itinerary_items (itinerary_id, trip_id, day_number, date, start_time, end_time, activity, description, estimated_cost, sort_order, source)
      values (v_it, p_trip_id, d, v_date, '20:00', '21:00', 'Dinner', 'Dinner at a local restaurant. Cost is an estimate from your food budget.', v_meal, v_ord, 'rule');
    end if;
  end loop;

  update itineraries set source = 'rule', name = 'Suggested plan' where id = v_it;
  return (select count(*) from itinerary_items where itinerary_id = v_it);
end $$;
