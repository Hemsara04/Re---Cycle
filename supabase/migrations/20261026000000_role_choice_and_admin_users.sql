-- =============================================================================
-- Re-සයිකල් LK — role choice for new accounts + admin user list
--
-- 1. choose_initial_role(): Google sign-in can't carry the role a person picked
--    on the sign-up page, so the app calls this right after their first login.
--    It only works within an hour of the account being created, before they've
--    posted anything, and never grants 'admin'.
-- 2. admin_list_users(): profiles + email (which lives in auth.users) for the
--    admin dashboard and CSV export.
-- =============================================================================

-- Let protect_profile_fields() step aside for choose_initial_role() only.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if (select auth.uid()) is not null
     and not public.is_admin()
     and coalesce(current_setting('app.choosing_role', true), '') <> 'on' then
    new.role := old.role;
    new.approved := old.approved;
  end if;
  return new;
end;
$$;

create function public.choose_initial_role(p_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  result public.profiles;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_role = 'admin' then
    raise exception 'That role can only be given by an admin' using errcode = '42501';
  end if;

  perform set_config('app.choosing_role', 'on', true); -- transaction-local
  update public.profiles
     set role = p_role,
         approved = p_role in ('seller', 'collector')
   where id = uid
     and role <> 'admin'
     and created_at > now() - interval '1 hour'
     and not exists (select 1 from public.listings where seller_id = uid)
  returning * into result;
  perform set_config('app.choosing_role', 'off', true);

  if result.id is null then
    raise exception 'Your account type can no longer be changed here. Ask an admin.' using errcode = '42501';
  end if;
  return result;
end;
$$;

create function public.admin_list_users()
returns table (
  id          uuid,
  email       text,
  full_name   text,
  phone       text,
  role        public.user_role,
  approved    boolean,
  created_at  timestamptz,
  listings    bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.phone, p.role, p.approved, p.created_at,
           (select count(*) from public.listings l where l.seller_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.choose_initial_role, public.admin_list_users from public, anon;
grant execute on function public.choose_initial_role, public.admin_list_users to authenticated;
