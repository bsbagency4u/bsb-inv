-- ============================================================================
-- BSB StockFlow — Auth profile username
--
-- Adds a globally unique username on public.profiles (1:1 with auth.users).
-- Username is application profile data only. Passwords stay in Supabase Auth.
-- Idempotent: safe to run against an existing Phase 1/4 database.
-- ============================================================================

alter table public.profiles add column if not exists username text;

-- Case-insensitive uniqueness. Existing rows may have a null username.
create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

-- Capture name, email and username from auth metadata on signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  incoming_username text;
begin
  incoming_username := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');

  insert into public.profiles (id, full_name, email, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    incoming_username
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        username = coalesce(excluded.username, public.profiles.username);

  return new;
end;
$$;

-- Availability check for signup (anon + authenticated). Returns true when free.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where username is not null
      and lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Allow a signed-in user to insert their own profile if the trigger did not.
drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
