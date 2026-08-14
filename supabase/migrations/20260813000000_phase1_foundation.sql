-- ============================================================================
-- BSB StockFlow — Phase 1 foundation schema
--
-- Multi-business (tenant) aware foundation:
--   roles / permissions / role_permissions
--   profiles
--   businesses
--   business_members
--   business_settings
--   audit_logs
--
-- Applies RLS on every business-scoped table. No universal anonymous write
-- policies. All business data access is gated by membership/ownership.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Timestamp trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------
create or replace function current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- Is the current user a member of the given business?
create or replace function is_business_member(business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from business_members bm
    where bm.business_id = is_business_member.business_id
      and bm.user_id = auth.uid()
  );
$$;

-- Is the current user an owner of the given business?
create or replace function is_business_owner(business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from business_members bm
    where bm.business_id = is_business_owner.business_id
      and bm.user_id = auth.uid()
      and bm.is_owner = true
  );
$$;

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.roles enable row level security;

create policy "roles are readable by any authenticated user"
  on public.roles for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.permissions enable row level security;

create policy "permissions are readable by any authenticated user"
  on public.permissions for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

create policy "role_permissions are readable by any authenticated user"
  on public.role_permissions for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  legal_name           text,
  type                 text not null default 'retail',
  logo_url             text,
  address              text,
  city                 text,
  state                text,
  country              text not null default 'India',
  pincode              text,
  phone                text,
  email                text,
  website              text,
  gstin                text,
  pan                  text,
  currency             text not null default 'INR',
  financial_year       text not null default '01-04',
  invoice_prefix       text not null default 'INV',
  invoice_start_number integer not null default 1001,
  is_active            boolean not null default true,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_businesses_type on public.businesses(type);
create index if not exists idx_businesses_active on public.businesses(is_active);

alter table public.businesses enable row level security;

-- Select: must be a member of the business
create policy "members can view their businesses"
  on public.businesses for select
  to authenticated
  using (is_business_member(id));

-- Insert: any authenticated user can create a business (they become owner via trigger)
create policy "authenticated users can create businesses"
  on public.businesses for insert
  to authenticated
  with check (true);

-- Update: owner only
create policy "owners can update their businesses"
  on public.businesses for update
  to authenticated
  using (is_business_owner(id))
  with check (is_business_owner(id));

-- ---------------------------------------------------------------------------
-- business_members
-- ---------------------------------------------------------------------------
create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid references public.roles(id),
  is_owner    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index if not exists idx_business_members_user on public.business_members(user_id);

alter table public.business_members enable row level security;

-- Select: user can view their own memberships
create policy "users can view their own memberships"
  on public.business_members for select
  to authenticated
  using (user_id = auth.uid() or is_business_member(business_id));

-- Insert: owners can add members; a user may join a business they created
create policy "owners can add members"
  on public.business_members for insert
  to authenticated
  with check (is_business_owner(business_id));

-- Update: owner only
create policy "owners can update memberships"
  on public.business_members for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

-- Delete: owner only
create policy "owners can remove memberships"
  on public.business_members for delete
  to authenticated
  using (is_business_owner(business_id));

-- Auto-make the creator an owner of their new business
create or replace function handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, is_owner)
  values (new.id, new.created_by, true)
  on conflict (business_id, user_id) do update set is_owner = true;
  return new;
end;
$$;

drop trigger if exists on_business_created on public.businesses;
create trigger on_business_created
  after insert on public.businesses
  for each row execute function handle_new_business();

-- ---------------------------------------------------------------------------
-- business_settings
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  business_id uuid not null references public.businesses(id) on delete cascade,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (business_id, key)
);

alter table public.business_settings enable row level security;

create policy "members can read business settings"
  on public.business_settings for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can write business settings"
  on public.business_settings for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update business settings"
  on public.business_settings for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete business settings"
  on public.business_settings for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_business on public.audit_logs(business_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "members can create audit entries"
  on public.audit_logs for insert
  to authenticated
  with check (business_id is null or is_business_member(business_id));

create policy "owners can read audit entries"
  on public.audit_logs for select
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at before update on public.roles
  for each row execute function set_updated_at();

drop trigger if exists set_permissions_updated_at on public.permissions;
create trigger set_permissions_updated_at before update on public.permissions
  for each row execute function set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function set_updated_at();

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at before update on public.businesses
  for each row execute function set_updated_at();

drop trigger if exists set_business_settings_updated_at on public.business_settings;
create trigger set_business_settings_updated_at before update on public.business_settings
  for each row execute function set_updated_at();
