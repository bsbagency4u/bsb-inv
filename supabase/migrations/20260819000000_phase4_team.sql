-- ============================================================================
-- BSB StockFlow — Phase 4 team & access
--
--   profiles.email            (needed to render the team list)
--   shares_business_with()     (RLS helper for co-member profile reads)
--   business_invitations       (pending invites that owners can manage)
--
-- Idempotent: safe to run against an existing Phase 1 database.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles.email
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;

-- Capture the auth email when a profile is created.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS helper: does the current user share any business with target user?
-- ---------------------------------------------------------------------------
create or replace function shares_business_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from business_members mine
    join business_members theirs on theirs.business_id = mine.business_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
  );
$$;

-- Co-members may read each other's basic profile (name, phone, avatar, email)
-- so team management can display the member list.
drop policy if exists "members can view co-member profiles" on public.profiles;
create policy "members can view co-member profiles"
  on public.profiles for select
  to authenticated
  using (shares_business_with(id));

-- ---------------------------------------------------------------------------
-- business_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.business_invitations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role_slug   text not null,
  invited_by  uuid references auth.users(id) on delete set null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One pending invite per email per business.
create unique index if not exists idx_business_invitations_pending_email
  on public.business_invitations (business_id, lower(email))
  where status = 'pending';

create index if not exists idx_business_invitations_business
  on public.business_invitations(business_id);

alter table public.business_invitations enable row level security;

create policy "members can read invitations"
  on public.business_invitations for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create invitations"
  on public.business_invitations for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update invitations"
  on public.business_invitations for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete invitations"
  on public.business_invitations for delete
  to authenticated
  using (is_business_owner(business_id));

drop trigger if exists set_business_invitations_updated_at on public.business_invitations;
create trigger set_business_invitations_updated_at
  before update on public.business_invitations
  for each row execute function set_updated_at();
