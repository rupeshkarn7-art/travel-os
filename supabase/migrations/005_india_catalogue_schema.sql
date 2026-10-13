-- Travel OS · 005 India catalogue schema
-- Adds regions, states/UTs, richer destination/attraction fields, circuits, state-level permits,
-- trip-planner preferences and search indexes. Additive only: no existing data is changed or deleted.
-- Safe to run more than once.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.regions (
  id text primary key,
  name text not null unique,
  sort_order int not null default 0,
  description text
);

create table if not exists public.states (
  id text primary key,
  slug text not null unique,
  name text not null unique,
  kind text not null check (kind in ('state','ut')),
  region_id text not null references public.regions(id),
  capital text,
  description text,
  latitude double precision, longitude double precision,
  tourism_url text,
  tourism_url_status text not null default 'unverified' check (tourism_url_status in ('verified','unverified')),
  sort_order int not null default 0
);

alter table public.destinations
  add column if not exists state_id text references public.states(id),
  add column if not exists district text,
  add column if not exists destination_type text,
  add column if not exists parent_id uuid references public.destinations(id) on delete set null,
  add column if not exists alt_names text[] not null default '{}',
  add column if not exists best_months int[] not null default '{}',
  add column if not exists season_notes text,
  add column if not exists highlights text[] not null default '{}',
  add column if not exists hidden_gems text[] not null default '{}',
  add column if not exists food text[] not null default '{}',
  add column if not exists traveller_profiles text[] not null default '{}',
  add column if not exists accessibility text,
  add column if not exists nearest_airport text,
  add column if not exists nearest_railway text,
  add column if not exists budget_tier text check (budget_tier in ('budget','standard','premium')),
  add column if not exists unesco boolean not null default false,
  add column if not exists source_org text,
  add column if not exists verification_status text not null default 'partially_verified'
     check (verification_status in ('verified','partially_verified','estimated','unverified')),
  add column if not exists completeness int not null default 0 check (completeness between 0 and 100),
  add column if not exists missing_fields text[] not null default '{}',
  add column if not exists search_text text;

alter table public.attractions
  add column if not exists slug text,
  add column if not exists significance text,
  add column if not exists entry_fee_text text,
  add column if not exists timings_text text,
  add column if not exists closed_days int[] not null default '{}',
  add column if not exists dress_code text,
  add column if not exists photography text,
  add column if not exists booking_url text,
  add column if not exists source_url text,
  add column if not exists source_org text,
  add column if not exists last_verified date,
  add column if not exists unesco boolean not null default false,
  add column if not exists verification_status text not null default 'partially_verified'
     check (verification_status in ('verified','partially_verified','estimated','unverified'));
create unique index if not exists attractions_dest_slug_key on public.attractions(destination_id, slug);

alter table public.permits alter column destination_id drop not null;
alter table public.permits
  add column if not exists state_id text references public.states(id),
  add column if not exists slug text,
  add column if not exists mandatory boolean not null default true,
  add column if not exists reconfirm_note text;
alter table public.permits drop constraint if exists permits_scope_check;
alter table public.permits add constraint permits_scope_check check (destination_id is not null or state_id is not null);
create unique index if not exists permits_slug_key on public.permits(slug);

create table if not exists public.travel_circuits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  region_id text references public.regions(id),
  days int not null check (days between 1 and 30),
  categories text[] not null default '{}',
  best_months int[] not null default '{}',
  verification_status text not null default 'partially_verified',
  status text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);
create table if not exists public.circuit_stops (
  circuit_id uuid not null references public.travel_circuits(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  stop_order int not null,
  nights int not null default 1 check (nights between 0 and 14),
  primary key (circuit_id, stop_order)
);

alter table public.trips
  add column if not exists adults int check (adults between 0 and 50),
  add column if not exists children int check (children between 0 and 50),
  add column if not exists pace text check (pace in ('relaxed','moderate','packed')),
  add column if not exists interests text[] not null default '{}',
  add column if not exists dietary text,
  add column if not exists accessibility_needs text,
  add column if not exists accommodation_pref text,
  add column if not exists travel_style text check (travel_style in ('budget','standard','premium'));

create index if not exists destinations_state_idx on public.destinations(state_id);
create index if not exists destinations_type_idx on public.destinations(destination_type);
create index if not exists destinations_cats_idx on public.destinations using gin(categories);
create index if not exists destinations_months_idx on public.destinations using gin(best_months);
create index if not exists destinations_search_trgm on public.destinations using gin(search_text extensions.gin_trgm_ops);
create index if not exists destinations_popularity_idx on public.destinations(popularity desc);
create index if not exists attractions_dest_idx on public.attractions(destination_id);
create index if not exists attractions_name_trgm on public.attractions using gin(name extensions.gin_trgm_ops);
create index if not exists permits_state_idx on public.permits(state_id);

alter table public.regions enable row level security;
alter table public.states enable row level security;
alter table public.travel_circuits enable row level security;
alter table public.circuit_stops enable row level security;
do $$ declare t text; begin
  foreach t in array array['regions','states','travel_circuits','circuit_stops'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
drop policy if exists travel_circuits_read on public.travel_circuits;
create policy travel_circuits_read on public.travel_circuits for select to anon, authenticated using (status = 'published' or public.is_admin());

create or replace function public.destinations_search_text() returns trigger language plpgsql set search_path = public as $$
begin
  new.search_text := lower(concat_ws(' ', new.name, array_to_string(new.alt_names, ' '), new.district, new.state,
    (select s.name || ' ' || r.name from public.states s join public.regions r on r.id = s.region_id where s.id = new.state_id),
    array_to_string(new.categories, ' '), new.destination_type, new.tagline, array_to_string(new.highlights, ' ')));
  return new;
end $$;
drop trigger if exists destinations_search_text_trg on public.destinations;
create trigger destinations_search_text_trg before insert or update on public.destinations
  for each row execute function public.destinations_search_text();
