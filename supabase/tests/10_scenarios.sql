\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

-- ── users (as Supabase Auth would insert them) ───────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'nimal@example.lk',   '{"full_name":"Nimal Perera","phone":"077 123 4567","role":"seller"}'),
  ('22222222-2222-2222-2222-222222222222', 'kamala@example.lk',  '{"full_name":"Kamala Silva","phone":"071-234-5678","role":"collector"}'),
  ('33333333-3333-3333-3333-333333333333', 'biz@example.lk',     '{"full_name":"Green Hotel","phone":"0761112222","role":"business"}'),
  ('44444444-4444-4444-4444-444444444444', 'sneaky@example.lk',  '{"full_name":"Sneaky","role":"admin"}'),
  ('55555555-5555-5555-5555-555555555555', 'admin@example.lk',   '{"name":"Admin From Google"}'),
  ('66666666-6666-6666-6666-666666666666', 'badphone@example.lk','{"full_name":"Bad Phone","phone":"not a phone","role":"collector"}');

do $$ begin
  assert (select role::text || approved::text from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'sellertrue', 'seller auto-approved';
  assert (select phone from public.profiles where id = '11111111-1111-1111-1111-111111111111') = '0771234567', 'phone normalised';
  assert (select approved from public.profiles where id = '33333333-3333-3333-3333-333333333333') = false, 'business needs approval';
  assert (select role from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'seller', 'requested admin role ignored';
  assert (select full_name from public.profiles where id = '55555555-5555-5555-5555-555555555555') = 'Admin From Google', 'Google name used';
  assert (select phone from public.profiles where id = '66666666-6666-6666-6666-666666666666') is null, 'bad phone does not block sign-up';
  raise notice 'PASS  sign-up trigger creates profiles with safe roles';
end $$;

-- first admin, created from a direct DB session (no auth.uid())
update public.profiles set role = 'admin', approved = true where id = '55555555-5555-5555-5555-555555555555';
do $$ begin
  assert (select role from public.profiles where id = '55555555-5555-5555-5555-555555555555') = 'admin', 'SQL editor can promote admin';
  raise notice 'PASS  first admin can be created from the SQL editor';
end $$;

-- ── seller posts listings ────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into public.listings (id, title, material, quantity_kg, description, pickup_date, pickup_from, pickup_to, location, province, district)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Arrack bottles', 'glass', 18, 'Clean, sorted', current_date + 2, '09:00', '12:00', 'POINT(79.8612 6.9271)', 'western', 'Colombo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Cardboard sheets', 'paper', 40, 'Dry', current_date + 3, '14:00', '17:00', 'POINT(80.6337 7.2906)', 'central', 'Kandy'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Old phones', 'ewaste', 2.5, '', current_date + 1, '10:00', '11:00', 'POINT(79.9925 7.0873)', 'western', 'Gampaha');
do $$ begin
  assert (select seller_id from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = '11111111-1111-1111-1111-111111111111', 'seller_id defaults to auth.uid()';
  raise notice 'PASS  approved seller can create listings (WKT point → geography)';
end $$;

-- seller can't move a listing to someone else
update public.listings set seller_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
do $$ begin
  assert (select seller_id from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = '11111111-1111-1111-1111-111111111111', 'seller_id is immutable';
  raise notice 'PASS  listing seller cannot be changed';
end $$;

-- invalid data is rejected by constraints
do $$ begin
  begin
    insert into public.listings (seller_id, title, material, quantity_kg, pickup_date, pickup_from, pickup_to, location, province, district)
    values ('11111111-1111-1111-1111-111111111111', 'Bad window', 'glass', 5, current_date, '12:00', '09:00', 'POINT(79.86 6.92)', 'western', 'Colombo');
    raise exception 'EXPECTED FAILURE: pickup window';
  exception when check_violation then null;
  end;
  raise notice 'PASS  pickup_from must be before pickup_to';
end $$;

-- ── unapproved business cannot post ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
set role authenticated;
do $$ begin
  begin
    insert into public.listings (title, material, quantity_kg, pickup_date, pickup_from, pickup_to, location, province, district)
    values ('Hotel glass', 'glass', 50, current_date + 1, '08:00', '10:00', 'POINT(79.86 6.92)', 'western', 'Colombo');
    raise exception 'EXPECTED FAILURE: unapproved insert';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  unapproved business is blocked from posting';
end $$;
reset role;

-- ── anonymous browsing ───────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  assert (select count(*) from public.search_listings()) = 3, 'anon sees 3 listings';
  assert (select count(*) from public.search_listings() where seller_phone is not null) = 0, 'anon never sees phone numbers';
  assert (select seller_name from public.search_listings() limit 1) = 'Nimal Perera', 'anon sees seller name';
  assert (select count(*) from public.listings) = 3, 'anon can select listings table';
  begin
    perform * from public.profiles;
    raise exception 'EXPECTED FAILURE: anon reading profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.request_claim('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'EXPECTED FAILURE: anon claiming';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  anonymous visitors can browse but not see phones, profiles or claim';
end $$;
reset role;

-- ── search filters & PostGIS "near me" ───────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$
declare r record;
begin
  assert (select count(*) from public.search_listings() where seller_phone = '0771234567') = 3, 'signed-in users see phone';
  -- near Colombo Fort, 10 km
  assert (select count(*) from public.search_listings(p_lat => 6.9344, p_lng => 79.8428, p_radius_km => 10)) = 1, 'only Colombo within 10 km';
  -- 25 km catches Gampaha too, nearest first
  select array_agg(district order by ord) as d, array_agg(round(distance_km::numeric, 1) order by ord) as km into r
  from (select district, distance_km, row_number() over () as ord
        from public.search_listings(p_lat => 6.9344, p_lng => 79.8428, p_radius_km => 25, p_sort => 'nearest')) s;
  assert r.d = array['Colombo', 'Gampaha'], format('nearest-first order, got %s', r.d);
  assert r.km[1] < 3 and r.km[2] between 15 and 25, format('distances look right, got %s', r.km);
  raise notice 'PASS  near-me radius + nearest sort: % km', r.km;

  assert (select count(*) from public.search_listings(p_province => 'western')) = 2, 'province filter';
  assert (select count(*) from public.search_listings(p_district => 'Kandy')) = 1, 'district filter';
  assert (select count(*) from public.search_listings(p_materials => array['glass', 'ewaste']::public.material_type[])) = 2, 'material filter';
  assert (select count(*) from public.search_listings(q => 'cardboard')) = 1, 'text search';
  assert (select count(*) from public.search_listings(p_min_kg => 10)) = 2, 'min kg';
  assert (select title from public.search_listings(p_sort => 'quantity') limit 1) = 'Cardboard sheets', 'quantity sort';
  raise notice 'PASS  text, province, district, material, quantity filters and sorts';
end $$;

-- ── claims workflow ──────────────────────────────────────────────────────────
-- collector requests
select id as claim_c from public.request_claim('aaaaaaaa-0000-0000-0000-000000000001', 'Can come at 10') \gset
select set_config('test.claim_c', :'claim_c', false);
do $$ begin
  begin
    perform public.request_claim('aaaaaaaa-0000-0000-0000-000000000001', 'again');
    raise exception 'EXPECTED FAILURE: duplicate claim';
  exception when unique_violation then null;
  end;
  raise notice 'PASS  collector can request once';
end $$;
-- another user also requests the same listing
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
select id as claim_other from public.request_claim('aaaaaaaa-0000-0000-0000-000000000001', 'me too') \gset
-- the seller can't claim their own listing, and a stranger can't answer claims
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  begin
    perform public.request_claim('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'EXPECTED FAILURE: own listing';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'PASS  seller cannot claim own listing';
end $$;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', false);
do $$ begin
  begin
    perform public.respond_to_claim(current_setting('test.claim_c')::uuid, true);
    raise exception 'EXPECTED FAILURE: stranger responding';
  exception when no_data_found then null;
  end;
  assert (select count(*) from public.claims) = 0, 'stranger sees no claims';
  raise notice 'PASS  only the seller can answer, strangers see no claims';
end $$;
-- seller sees both requests and accepts the first
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select count(*) from public.claims) = 2, 'seller sees requests on own listing';
end $$;
select status from public.respond_to_claim(:'claim_c'::uuid, true);
do $$ begin
  assert (select status from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'claimed', 'listing claimed';
  assert (select status from public.claims where collector_id = '44444444-4444-4444-4444-444444444444') = 'declined', 'other pending claim declined';
  raise notice 'PASS  accepting a claim marks listing claimed and declines the rest';
end $$;
-- claimed listings leave the feed but can still be opened directly
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.search_listings()) = 2, 'claimed listing hidden from feed';
  assert (select status from public.search_listings(p_id => 'aaaaaaaa-0000-0000-0000-000000000001')) = 'claimed', 'p_id fetch returns it';
  assert (select count(*) from public.claims) = 1, 'collector sees only own claim';
  begin
    perform public.request_claim('aaaaaaaa-0000-0000-0000-000000000001');
    raise exception 'EXPECTED FAILURE: claiming a claimed listing';
  exception when no_data_found then null;
  end;
  raise notice 'PASS  claimed listings leave the feed, collector sees own claim only';
end $$;
-- collector request + cancel on another listing, then re-request reopens it
select id as claim2 from public.request_claim('aaaaaaaa-0000-0000-0000-000000000002', 'hi') \gset
select status from public.cancel_claim(:'claim2'::uuid);
select status as reopened from public.request_claim('aaaaaaaa-0000-0000-0000-000000000002', 'hi again') \gset
select set_config('test.reopened', :'reopened', false);
do $$ begin
  assert current_setting('test.reopened') = 'pending', 're-request after cancel';
  raise notice 'PASS  cancel + re-request';
end $$;

-- ── profile protection ───────────────────────────────────────────────────────
update public.profiles set role = 'admin', approved = true, full_name = 'Kamala S.' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set full_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';
update public.listings set title = 'Hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
reset role;
do $$ begin
  assert (select role::text || '/' || full_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'collector/Kamala S.', 'can edit name but not role';
  assert (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Nimal Perera', 'cannot edit others';
  assert (select title from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 'Cardboard sheets', 'cannot edit others'' listings';
  raise notice 'PASS  users can edit their own name, not their role, nor other people''s data';
end $$;

-- ── reports + admin ──────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into public.reports (listing_id, reason) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Looks like a duplicate');
do $$ begin
  assert (select count(*) from public.reports) = 1, 'reporter sees own report';
  begin
    perform public.admin_stats();
    raise exception 'EXPECTED FAILURE: non-admin stats';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  reports work, admin_stats is admin-only';
end $$;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
do $$
declare s jsonb := public.admin_stats();
begin
  assert jsonb_array_length(s -> 'listings_per_week') = 8, 'eight weeks';
  assert (s -> 'totals' ->> 'live_listings')::int = 2, 'live listings';
  assert (s -> 'claims' ->> 'accepted')::int = 1, 'accepted claims';
  assert (s -> 'totals' ->> 'pending_approvals')::int = 1, 'pending approvals';
  raise notice 'PASS  admin_stats: %', s -> 'totals';
end $$;
update public.profiles set approved = true where id = '33333333-3333-3333-3333-333333333333';
update public.reports set resolved = true, resolved_by = auth.uid(), resolved_at = now();
update public.listings set status = 'removed' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
do $$ begin
  assert (select approved from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 'admin approved business';
  assert (select bool_and(resolved) from public.reports), 'admin resolved report';
  raise notice 'PASS  admin can approve users, resolve reports and remove listings';
end $$;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  assert (select count(*) from public.listings where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 0, 'removed listing hidden from public';
  raise notice 'PASS  removed listings disappear for the public';
end $$;
reset role;

-- ── storage: own folder only ─────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('listing-photos', '11111111-1111-1111-1111-111111111111/bottles.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('listing-photos', '22222222-2222-2222-2222-222222222222/evil.jpg');
    raise exception 'EXPECTED FAILURE: upload into another user''s folder';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  photo uploads restricted to the user''s own folder';
end $$;
reset role;

\echo ALL SCENARIOS PASSED
