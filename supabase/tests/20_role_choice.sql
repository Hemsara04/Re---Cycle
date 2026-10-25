\set ON_ERROR_STOP 1
\set QUIET 1
-- runs after 10_scenarios.sql (same database)

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'google.user@gmail.com', '{"name":"Google User"}');

select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', false);
set role authenticated;
do $$ begin
  assert (select role from public.choose_initial_role('recycler')) = 'recycler', 'fresh Google user can pick a role';
  assert (select approved from public.profiles where id = auth.uid()) = false, 'recycler waits for approval';
  assert (select role from public.choose_initial_role('collector')) = 'collector', 'can change mind in the first hour';
  assert (select approved from public.profiles where id = auth.uid()) = true, 'collector auto-approved';
  begin
    perform public.choose_initial_role('admin');
    raise exception 'EXPECTED FAILURE: choosing admin';
  exception when insufficient_privilege then null;
  end;
  -- the bypass flag must not leak: a normal update still can't change role
  update public.profiles set role = 'recycler' where id = auth.uid();
  assert (select role from public.profiles where id = auth.uid()) = 'collector', 'normal update still protected';
  begin
    perform public.admin_list_users();
    raise exception 'EXPECTED FAILURE: non-admin listing users';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  choose_initial_role: new users pick a non-admin role once; flag does not leak';
end $$;
reset role;

-- an established user (Nimal has listings) can't use it
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin
  begin
    perform public.choose_initial_role('recycler');
    raise exception 'EXPECTED FAILURE: user with listings';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS  choose_initial_role refuses accounts that already posted';
end $$;
reset role;

-- admin sees everyone with emails
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.admin_list_users()) = 7, 'admin sees all users';
  assert (select email from public.admin_list_users() where full_name = 'Nimal Perera') = 'nimal@example.lk', 'with emails';
  assert (select listings from public.admin_list_users() where full_name = 'Nimal Perera') = 3, 'and listing counts';
  raise notice 'PASS  admin_list_users returns emails and listing counts';
end $$;
reset role;
\echo ROLE CHOICE SCENARIOS PASSED
