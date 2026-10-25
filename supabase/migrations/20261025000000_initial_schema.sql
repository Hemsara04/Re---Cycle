-- =============================================================================
-- Re-සයිකල් LK — initial schema
--
-- Run once on a fresh project: Supabase Dashboard → SQL Editor → paste → Run,
-- or `supabase db push` with the Supabase CLI.
--
-- Security model: the web app is a static site that talks to Supabase from the
-- browser with the publishable key, so EVERY table has Row Level Security and
-- anything that touches more than one row/table goes through a function.
-- =============================================================================


-- ─── Extensions ──────────────────────────────────────────────────────────────

create extension if not exists postgis with schema extensions;


-- ─── Types (mirror src/lib/types.ts) ─────────────────────────────────────────

create type public.user_role as enum ('seller', 'collector', 'business', 'recycler', 'admin');
create type public.material_type as enum ('plastic', 'paper', 'glass', 'ewaste', 'organic', 'metal', 'textile');
create type public.province as enum (
  'western', 'central', 'southern', 'northern', 'eastern',
  'north-western', 'north-central', 'uva', 'sabaragamuwa'
);
create type public.listing_status as enum ('available', 'claimed', 'removed');
create type public.claim_status as enum ('pending', 'accepted', 'declined', 'cancelled');


-- ─── Shared helpers ──────────────────────────────────────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ─── Profiles (1:1 with auth.users) ──────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  -- Sri Lankan mobile, stored without spaces: 0771234567 or +94771234567
  phone       text check (phone is null or phone ~ '^(\+94|94|0)7[0-9]{8}$'),
  role        public.user_role not null default 'seller',
  -- sellers & collectors are approved on sign-up; businesses & recyclers wait for an admin
  approved    boolean not null default false,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing user details. Created automatically by the on_auth_user_created trigger.';

create index profiles_role_idx on public.profiles (role);
create index profiles_pending_idx on public.profiles (created_at) where not approved;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role checks used by policies. SECURITY DEFINER so they can read profiles
-- without recursing into the profiles RLS policies.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and approved
  );
$$;

-- New auth user → profile row. Reads what the sign-up form put in user metadata
-- (supabase.auth.signUp({ options: { data: { full_name, phone, role } } })) and
-- what Google provides (name). Never trusts a requested 'admin' role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested text  := meta ->> 'role';
  new_role  public.user_role;
  new_phone text  := nullif(regexp_replace(coalesce(meta ->> 'phone', ''), '[\s-]', '', 'g'), '');
begin
  new_role := case
    when requested in ('seller', 'collector', 'business', 'recycler') then requested::public.user_role
    else 'seller'
  end;

  -- a malformed phone must not block sign-up; the user can fix it in their profile
  if new_phone is not null and new_phone !~ '^(\+94|94|0)7[0-9]{8}$' then
    new_phone := null;
  end if;

  insert into public.profiles (id, full_name, phone, role, approved, avatar_url)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', split_part(new.email, '@', 1), ''), 120),
    new_phone,
    new_role,
    new_role in ('seller', 'collector'),
    meta ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own name/phone/avatar, but only admins can change role
-- or approval. Direct database sessions (SQL editor, service role) have no
-- auth.uid() and are allowed — that's how the first admin is created.
create function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if (select auth.uid()) is not null and not public.is_admin() then
    new.role := old.role;
    new.approved := old.approved;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();


-- ─── Listings ────────────────────────────────────────────────────────────────

create table public.listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 80),
  material     public.material_type not null,
  quantity_kg  numeric(10, 2) not null check (quantity_kg > 0 and quantity_kg <= 100000),
  description  text not null default '' check (char_length(description) <= 2000),
  -- storage paths inside the listing-photos bucket, e.g. '<user-id>/<uuid>.jpg'
  photos       text[] not null default '{}' check (cardinality(photos) <= 4),
  pickup_date  date not null,
  pickup_from  time not null,
  pickup_to    time not null,
  -- WGS84 point; insert from the client as 'POINT(lng lat)'
  location     extensions.geography(point, 4326) not null,
  province     public.province not null,
  district     text not null check (char_length(district) between 2 and 40),
  status       public.listing_status not null default 'available',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint listings_pickup_window check (pickup_from < pickup_to)
);

comment on column public.listings.location is 'Pickup point. Used by search_listings() for "near me" (ST_DWithin).';

create index listings_location_idx on public.listings using gist (location);
create index listings_feed_idx on public.listings (status, created_at desc);
create index listings_material_idx on public.listings (material) where status = 'available';
create index listings_province_idx on public.listings (province) where status = 'available';
create index listings_seller_idx on public.listings (seller_id);

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- A listing can't be handed to a different seller after it's created
create function public.protect_listing_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.seller_id := old.seller_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger listings_protect_fields
  before update on public.listings
  for each row execute function public.protect_listing_fields();


-- ─── Claims ──────────────────────────────────────────────────────────────────

create table public.claims (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  collector_id  uuid not null references public.profiles (id) on delete cascade,
  message       text not null default '' check (char_length(message) <= 500),
  status        public.claim_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (listing_id, collector_id)
);

create index claims_listing_idx on public.claims (listing_id, status);
create index claims_collector_idx on public.claims (collector_id, created_at desc);

create trigger claims_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();


-- ─── Reports ─────────────────────────────────────────────────────────────────

create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  reporter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 500),
  resolved     boolean not null default false,
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index reports_open_idx on public.reports (created_at desc) where not resolved;
create index reports_listing_idx on public.reports (listing_id);


-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.claims enable row level security;
alter table public.reports enable row level security;

-- profiles: signed-in users can see each other (needed for WhatsApp/call contact);
-- anonymous visitors see seller names through search_listings() only.
create policy "Signed-in users can view profiles"
  on public.profiles for select to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- listings: anyone can browse non-removed listings
create policy "Anyone can view active listings"
  on public.listings for select to anon, authenticated
  using (
    status <> 'removed'
    or seller_id = (select auth.uid())
    or (select public.is_admin())
  );

create policy "Approved users can create listings"
  on public.listings for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'available'
    and (select public.is_approved())
  );

create policy "Sellers can update their own listings"
  on public.listings for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "Admins can update any listing"
  on public.listings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Sellers and admins can delete listings"
  on public.listings for delete to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));

-- claims: visible to the collector, the listing's seller, and admins.
-- Writes go through request_claim / respond_to_claim / cancel_claim.
create policy "Claim parties and admins can view claims"
  on public.claims for select to authenticated
  using (
    collector_id = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = claims.listing_id and l.seller_id = (select auth.uid())
    )
    or (select public.is_admin())
  );

-- reports
create policy "Signed-in users can report listings"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and not resolved);

create policy "Reporters and admins can view reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins can resolve reports"
  on public.reports for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Explicit table privileges (RLS above decides which rows). Supabase grants
-- everything to anon/authenticated by default; narrow that to what the app uses.
revoke all on public.profiles, public.listings, public.claims, public.reports from anon, authenticated;
grant select on public.listings to anon;
grant select, insert, update, delete on public.listings to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.claims to authenticated;
grant select, insert, update on public.reports to authenticated;


-- =============================================================================
-- Functions the app calls with supabase.rpc(...)
-- =============================================================================

-- Find page: text search, filters, and "near me" via PostGIS.
-- Seller phone numbers are only returned to signed-in users.
create function public.search_listings(
  q             text                   default null,
  p_province    public.province        default null,
  p_district    text                   default null,
  p_materials   public.material_type[] default null,
  p_min_kg      numeric                default 0,
  p_since       timestamptz            default null,
  p_lat         double precision       default null,
  p_lng         double precision       default null,
  p_radius_km   double precision       default null,
  p_sort        text                   default 'newest', -- 'newest' | 'nearest' | 'quantity'
  p_limit       integer                default 200,
  p_offset      integer                default 0,
  p_id          uuid                   default null      -- fetch one listing (any non-removed status)
)
returns table (
  id            uuid,
  title         text,
  material      public.material_type,
  quantity_kg   numeric,
  description   text,
  photos        text[],
  pickup_date   date,
  pickup_from   time,
  pickup_to     time,
  lat           double precision,
  lng           double precision,
  province      public.province,
  district      text,
  status        public.listing_status,
  created_at    timestamptz,
  seller_id     uuid,
  seller_name   text,
  seller_phone  text,
  distance_km   double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select case
      when p_lat is not null and p_lng is not null
        then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    end as point
  )
  select
    l.id, l.title, l.material, l.quantity_kg, l.description, l.photos,
    l.pickup_date, l.pickup_from, l.pickup_to,
    extensions.st_y(l.location::extensions.geometry) as lat,
    extensions.st_x(l.location::extensions.geometry) as lng,
    l.province, l.district, l.status, l.created_at,
    l.seller_id,
    p.full_name as seller_name,
    case when (select auth.uid()) is not null then p.phone end as seller_phone,
    case when o.point is not null then extensions.st_distance(l.location, o.point) / 1000.0 end as distance_km
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  cross join origin o
  where
    case
      when p_id is not null then l.id = p_id and l.status <> 'removed'
      else l.status = 'available'
    end
    and (p_province is null or l.province = p_province)
    and (p_district is null or l.district = p_district)
    and (p_materials is null or cardinality(p_materials) = 0 or l.material = any (p_materials))
    and l.quantity_kg >= coalesce(p_min_kg, 0)
    and (p_since is null or l.created_at >= p_since)
    and (
      q is null or q = ''
      or l.title ilike '%' || q || '%'
      or l.description ilike '%' || q || '%'
      or l.district ilike '%' || q || '%'
      or l.material::text ilike '%' || q || '%'
    )
    and (
      o.point is null or p_radius_km is null
      or extensions.st_dwithin(l.location, o.point, p_radius_km * 1000.0)
    )
  order by
    case when p_sort = 'nearest' and o.point is not null then extensions.st_distance(l.location, o.point) end asc nulls last,
    case when p_sort = 'quantity' then l.quantity_kg end desc nulls last,
    l.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_listings to anon, authenticated;


-- A collector asks for a listing. Re-requesting after a cancel/decline reopens the claim.
create function public.request_claim(p_listing_id uuid, p_message text default '')
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  listing public.listings;
  result  public.claims;
begin
  if uid is null then
    raise exception 'Sign in to claim a listing' using errcode = '42501';
  end if;
  if not public.is_approved() then
    raise exception 'Your account is waiting for admin approval' using errcode = '42501';
  end if;

  select * into listing from public.listings where id = p_listing_id;
  if not found or listing.status <> 'available' then
    raise exception 'This listing is no longer available' using errcode = 'P0002';
  end if;
  if listing.seller_id = uid then
    raise exception 'You can''t claim your own listing' using errcode = '22023';
  end if;

  insert into public.claims (listing_id, collector_id, message)
  values (p_listing_id, uid, left(coalesce(p_message, ''), 500))
  on conflict (listing_id, collector_id) do update
    set message = excluded.message, status = 'pending', responded_at = null
    where public.claims.status in ('cancelled', 'declined')
  returning * into result;

  if result.id is null then
    raise exception 'You already have a request for this listing' using errcode = '23505';
  end if;
  return result;
end;
$$;

-- The seller accepts or declines. Accepting marks the listing claimed and
-- declines every other pending request for it.
create function public.respond_to_claim(p_claim_id uuid, p_accept boolean)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  claim  public.claims;
  result public.claims;
begin
  select c.* into claim
  from public.claims c
  join public.listings l on l.id = c.listing_id
  where c.id = p_claim_id and (l.seller_id = uid or public.is_admin())
  for update of c;

  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if claim.status <> 'pending' then
    raise exception 'This request was already %', claim.status using errcode = '22023';
  end if;

  update public.claims
     set status = case when p_accept then 'accepted' else 'declined' end::public.claim_status,
         responded_at = now()
   where id = p_claim_id
  returning * into result;

  if p_accept then
    update public.listings set status = 'claimed' where id = claim.listing_id;
    update public.claims
       set status = 'declined', responded_at = now()
     where listing_id = claim.listing_id and id <> p_claim_id and status = 'pending';
  end if;
  return result;
end;
$$;

-- The collector withdraws a pending request.
create function public.cancel_claim(p_claim_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.claims;
begin
  update public.claims
     set status = 'cancelled'
   where id = p_claim_id and collector_id = (select auth.uid()) and status = 'pending'
  returning * into result;
  if result.id is null then
    raise exception 'No pending request to cancel' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

-- Admin dashboard numbers in one round trip.
create function public.admin_stats(p_weeks integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n_weeks integer := least(greatest(coalesce(p_weeks, 8), 1), 52);
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'listings_per_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week_start', w.week_start, 'count', w.n) order by w.week_start), '[]')
      from (
        select gs.week_start::date as week_start,
               (select count(*) from public.listings l
                 where l.created_at >= gs.week_start and l.created_at < gs.week_start + interval '7 days') as n
        from generate_series(
          date_trunc('week', now()) - make_interval(weeks => n_weeks - 1),
          date_trunc('week', now()),
          interval '7 days'
        ) as gs(week_start)
      ) w
    ),
    'top_materials', (
      select coalesce(jsonb_agg(jsonb_build_object('material', m.material, 'count', m.n, 'kg', m.kg) order by m.n desc), '[]')
      from (
        select material, count(*) as n, round(sum(quantity_kg)) as kg
        from public.listings where status <> 'removed'
        group by material
      ) m
    ),
    'claims', (
      select jsonb_build_object(
        'pending',   count(*) filter (where status = 'pending'),
        'accepted',  count(*) filter (where status = 'accepted'),
        'declined',  count(*) filter (where status = 'declined'),
        'cancelled', count(*) filter (where status = 'cancelled')
      ) from public.claims
    ),
    'totals', jsonb_build_object(
      'live_listings',     (select count(*) from public.listings where status = 'available'),
      'kg_available',      (select coalesce(round(sum(quantity_kg)), 0) from public.listings where status = 'available'),
      'users',             (select count(*) from public.profiles),
      'pending_approvals', (select count(*) from public.profiles where not approved),
      'open_reports',      (select count(*) from public.reports where not resolved)
    )
  );
end;
$$;

revoke execute on function public.request_claim, public.respond_to_claim, public.cancel_claim, public.admin_stats from public, anon;
grant execute on function public.request_claim, public.respond_to_claim, public.cancel_claim, public.admin_stats to authenticated;
revoke execute on function public.handle_new_user from public, anon, authenticated;


-- =============================================================================
-- Storage: listing photos
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Public bucket: files are readable by URL. Uploads must go into the user's own
-- folder: '<auth.uid()>/<filename>'.
create policy "Users upload listing photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users manage their own listing photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own listing photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- =============================================================================
-- First admin (run separately, after you've signed up in the app):
--
--   update public.profiles set role = 'admin', approved = true
--   where id = (select id from auth.users where email = 'you@example.com');
-- =============================================================================
