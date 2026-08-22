-- ============================================================================
-- BSB StockFlow — Phase 2 Part 1: Core inventory engine
--
-- Extends the Phase 2 operations schema with:
--   - units, brands (configurable reference data)
--   - warehouses and stock locations
--   - product variants and product images
--   - richer product fields (description, min/max stock, reorder level,
--     track inventory, taxable flag, product status)
--   - category active flag
--   - stock ledger movement types (OPENING/ADJUSTMENT/TRANSFER_IN/TRANSFER_OUT/
--     SCRAP active now; PURCHASE/SALE/RETURNS connected in later phases)
--   - per-warehouse/location stock balances view
--
-- RLS: all new tables are business-scoped; select = members, write = owners.
-- Ledger remains append-mostly (members can insert movements; no edits).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- units (configurable unit of measure)
-- ---------------------------------------------------------------------------
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  code        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, code)
);

create index if not exists idx_units_business on public.units(business_id);

alter table public.units enable row level security;

create policy "members can view units"
  on public.units for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create units"
  on public.units for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update units"
  on public.units for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete units"
  on public.units for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  description text,
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, name)
);

create index if not exists idx_brands_business on public.brands(business_id);

alter table public.brands enable row level security;

create policy "members can view brands"
  on public.brands for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create brands"
  on public.brands for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update brands"
  on public.brands for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete brands"
  on public.brands for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- warehouses
-- ---------------------------------------------------------------------------
create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  code        text not null,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, code)
);

create index if not exists idx_warehouses_business on public.warehouses(business_id);

alter table public.warehouses enable row level security;

create policy "members can view warehouses"
  on public.warehouses for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create warehouses"
  on public.warehouses for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update warehouses"
  on public.warehouses for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete warehouses"
  on public.warehouses for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- stock_locations (locations inside a warehouse)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_locations (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  parent_id    uuid references public.stock_locations(id) on delete set null,
  name         text not null,
  code         text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, warehouse_id, code)
);

create index if not exists idx_stock_locations_business on public.stock_locations(business_id);
create index if not exists idx_stock_locations_warehouse on public.stock_locations(warehouse_id);

alter table public.stock_locations enable row level security;

create policy "members can view stock locations"
  on public.stock_locations for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create stock locations"
  on public.stock_locations for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update stock locations"
  on public.stock_locations for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete stock locations"
  on public.stock_locations for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- product_variants (independent identification, SKU, barcode, stock)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  sku            text,
  barcode        text,
  attributes     jsonb not null default '{}'::jsonb,
  sale_price     numeric(14,2),
  purchase_price numeric(14,2),
  mrp            numeric(14,2),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, sku),
  unique (business_id, barcode)
);

create index if not exists idx_product_variants_business on public.product_variants(business_id);
create index if not exists idx_product_variants_product on public.product_variants(product_id);

alter table public.product_variants enable row level security;

create policy "members can view product variants"
  on public.product_variants for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create product variants"
  on public.product_variants for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update product variants"
  on public.product_variants for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete product variants"
  on public.product_variants for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- product_images (references into Supabase Storage; no binaries in Postgres)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete cascade,
  storage_path text not null,
  url          text not null,
  position     integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_product_images_business on public.product_images(business_id);
create index if not exists idx_product_images_product on public.product_images(product_id);

alter table public.product_images enable row level security;

create policy "members can view product images"
  on public.product_images for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create product images"
  on public.product_images for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update product images"
  on public.product_images for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete product images"
  on public.product_images for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- Extend products
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists description       text,
  add column if not exists brand_id          uuid references public.brands(id) on delete set null,
  add column if not exists unit_id           uuid references public.units(id) on delete set null,
  add column if not exists min_stock         numeric(12,2) not null default 0,
  add column if not exists max_stock         numeric(12,2),
  add column if not exists reorder_level     numeric(12,2) not null default 0,
  add column if not exists track_inventory   boolean not null default true,
  add column if not exists taxable           boolean not null default true,
  add column if not exists product_status    text not null default 'active';

create index if not exists idx_products_brand on public.products(brand_id);
create index if not exists idx_products_unit on public.products(unit_id);

-- ---------------------------------------------------------------------------
-- Extend categories with an active flag
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- Extend stock_ledger: movement types, variant and location targeting
-- ---------------------------------------------------------------------------
alter table public.stock_ledger
  add column if not exists movement_type    text not null default 'ADJUSTMENT',
  add column if not exists variant_id       uuid references public.product_variants(id) on delete set null,
  add column if not exists warehouse_id     uuid references public.warehouses(id) on delete set null,
  add column if not exists location_id      uuid references public.stock_locations(id) on delete set null,
  add column if not exists to_warehouse_id  uuid references public.warehouses(id) on delete set null,
  add column if not exists to_location_id   uuid references public.stock_locations(id) on delete set null;

alter table public.stock_ledger
  drop constraint if exists stock_ledger_movement_type_check;

alter table public.stock_ledger
  add constraint stock_ledger_movement_type_check check (
    movement_type in (
      'OPENING', 'PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALE_RETURN',
      'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'SCRAP'
    )
  );

create index if not exists idx_stock_ledger_movement on public.stock_ledger(business_id, movement_type);
create index if not exists idx_stock_ledger_warehouse on public.stock_ledger(business_id, warehouse_id);

-- ---------------------------------------------------------------------------
-- Stock balances view: one authoritative per-warehouse/location stock number
-- (security_invoker so RLS applies to the underlying ledger rows)
-- ---------------------------------------------------------------------------
create or replace view public.stock_balances
with (security_invoker = true)
as
select
  business_id,
  product_id,
  variant_id,
  warehouse_id,
  location_id,
  sum(change) as quantity,
  max(created_at) as last_movement_at
from public.stock_ledger
group by business_id, product_id, variant_id, warehouse_id, location_id;

-- ---------------------------------------------------------------------------
-- updated_at triggers for the new tables
-- ---------------------------------------------------------------------------drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at before update on public.units
  for each row execute function set_updated_at();

drop trigger if exists set_brands_updated_at on public.brands;
create trigger set_brands_updated_at before update on public.brands
  for each row execute function set_updated_at();

drop trigger if exists set_warehouses_updated_at on public.warehouses;
create trigger set_warehouses_updated_at before update on public.warehouses
  for each row execute function set_updated_at();

drop trigger if exists set_stock_locations_updated_at on public.stock_locations;
create trigger set_stock_locations_updated_at before update on public.stock_locations
  for each row execute function set_updated_at();

drop trigger if exists set_product_variants_updated_at on public.product_variants;
create trigger set_product_variants_updated_at before update on public.product_variants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket for product images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "anyone can read public product images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-images');
