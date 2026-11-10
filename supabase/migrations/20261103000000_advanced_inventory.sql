-- Advanced inventory: warehouse details, location kinds, transfers, adjustments,
-- physical counts, reservations, serials, and batch manufacturing metadata.
-- Stock remains append-only via public.stock_ledger.

-- ---------------------------------------------------------------------------
-- warehouses: contact and address details
-- ---------------------------------------------------------------------------
alter table public.warehouses add column if not exists state text;
alter table public.warehouses add column if not exists pincode text;
alter table public.warehouses add column if not exists phone text;
alter table public.warehouses add column if not exists email text;

-- ---------------------------------------------------------------------------
-- stock_locations: kind (main store, rack, damaged, quarantine, ...)
-- ---------------------------------------------------------------------------
alter table public.stock_locations add column if not exists kind text not null default 'main_store';

-- ---------------------------------------------------------------------------
-- warehouse_users: optional staff assignment
-- ---------------------------------------------------------------------------
create table if not exists public.warehouse_users (
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (warehouse_id, user_id)
);

create index if not exists idx_warehouse_users_user on public.warehouse_users(user_id);

alter table public.warehouse_users enable row level security;

create policy "members can view warehouse users"
  on public.warehouse_users for select
  to authenticated
  using (
    exists (
      select 1 from public.warehouses w
      where w.id = warehouse_id and is_business_member(w.business_id)
    )
  );

create policy "owners can manage warehouse users"
  on public.warehouse_users for all
  to authenticated
  using (
    exists (
      select 1 from public.warehouses w
      where w.id = warehouse_id and is_business_owner(w.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.warehouses w
      where w.id = warehouse_id and is_business_owner(w.business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- product_batches: manufacturing date and purchase/supplier snapshot
-- ---------------------------------------------------------------------------
alter table public.product_batches add column if not exists manufacturing_date date;
alter table public.product_batches add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.product_batches add column if not exists purchase_invoice_id uuid;

-- ---------------------------------------------------------------------------
-- stock_transfers
-- ---------------------------------------------------------------------------
create table if not exists public.stock_transfers (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  transfer_no        text not null,
  status             text not null default 'draft',
  from_warehouse_id  uuid not null references public.warehouses(id),
  from_location_id   uuid references public.stock_locations(id) on delete set null,
  to_warehouse_id    uuid not null references public.warehouses(id),
  to_location_id     uuid references public.stock_locations(id) on delete set null,
  requested_by       uuid references public.profiles(id) on delete set null,
  dispatched_by      uuid references public.profiles(id) on delete set null,
  received_by        uuid references public.profiles(id) on delete set null,
  requested_at       timestamptz not null default now(),
  dispatched_at      timestamptz,
  received_at        timestamptz,
  notes              text,
  shortage_reason    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, transfer_no)
);

create index if not exists idx_stock_transfers_business on public.stock_transfers(business_id, created_at desc);

create table if not exists public.stock_transfer_items (
  id                   uuid primary key default gen_random_uuid(),
  transfer_id          uuid not null references public.stock_transfers(id) on delete cascade,
  product_id           uuid not null references public.products(id),
  variant_id           uuid,
  batch_id             uuid,
  quantity             numeric not null,
  dispatched_quantity  numeric not null default 0,
  received_quantity    numeric not null default 0,
  shortage_quantity    numeric not null default 0,
  unit                 text,
  notes                text
);

create index if not exists idx_stock_transfer_items_transfer on public.stock_transfer_items(transfer_id);

alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy "members can view stock transfers"
  on public.stock_transfers for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert stock transfers"
  on public.stock_transfers for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update stock transfers"
  on public.stock_transfers for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "members can view stock transfer items"
  on public.stock_transfer_items for select
  to authenticated
  using (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id and is_business_member(t.business_id)
    )
  );

create policy "members can insert stock transfer items"
  on public.stock_transfer_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id and is_business_member(t.business_id)
    )
  );

create policy "members can update stock transfer items"
  on public.stock_transfer_items for update
  to authenticated
  using (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id and is_business_member(t.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.stock_transfers t
      where t.id = transfer_id and is_business_member(t.business_id)
    )
  );

drop trigger if exists set_stock_transfers_updated_at on public.stock_transfers;
create trigger set_stock_transfers_updated_at before update on public.stock_transfers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_adjustments
-- ---------------------------------------------------------------------------
create table if not exists public.stock_adjustments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  adjustment_no text not null,
  status        text not null default 'draft',
  reason        text not null,
  warehouse_id  uuid references public.warehouses(id) on delete set null,
  location_id   uuid references public.stock_locations(id) on delete set null,
  notes         text,
  requested_by  uuid references public.profiles(id) on delete set null,
  approved_by   uuid references public.profiles(id) on delete set null,
  posted_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, adjustment_no)
);

create index if not exists idx_stock_adjustments_business on public.stock_adjustments(business_id, created_at desc);

create table if not exists public.stock_adjustment_items (
  id            uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.stock_adjustments(id) on delete cascade,
  product_id    uuid not null references public.products(id),
  variant_id    uuid,
  batch_id      uuid,
  change        numeric not null,
  unit          text,
  notes         text
);

create index if not exists idx_stock_adjustment_items_adj on public.stock_adjustment_items(adjustment_id);

alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;

create policy "members can view stock adjustments"
  on public.stock_adjustments for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert stock adjustments"
  on public.stock_adjustments for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update stock adjustments"
  on public.stock_adjustments for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "members can view stock adjustment items"
  on public.stock_adjustment_items for select
  to authenticated
  using (
    exists (
      select 1 from public.stock_adjustments a
      where a.id = adjustment_id and is_business_member(a.business_id)
    )
  );

create policy "members can insert stock adjustment items"
  on public.stock_adjustment_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stock_adjustments a
      where a.id = adjustment_id and is_business_member(a.business_id)
    )
  );

create policy "members can update stock adjustment items"
  on public.stock_adjustment_items for update
  to authenticated
  using (
    exists (
      select 1 from public.stock_adjustments a
      where a.id = adjustment_id and is_business_member(a.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.stock_adjustments a
      where a.id = adjustment_id and is_business_member(a.business_id)
    )
  );

drop trigger if exists set_stock_adjustments_updated_at on public.stock_adjustments;
create trigger set_stock_adjustments_updated_at before update on public.stock_adjustments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_counts
-- ---------------------------------------------------------------------------
create table if not exists public.stock_counts (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  count_no     text not null,
  status       text not null default 'draft',
  warehouse_id uuid not null references public.warehouses(id),
  location_id  uuid references public.stock_locations(id) on delete set null,
  notes        text,
  counted_by   uuid references public.profiles(id) on delete set null,
  approved_by  uuid references public.profiles(id) on delete set null,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, count_no)
);

create index if not exists idx_stock_counts_business on public.stock_counts(business_id, created_at desc);

create table if not exists public.stock_count_items (
  id                uuid primary key default gen_random_uuid(),
  count_id          uuid not null references public.stock_counts(id) on delete cascade,
  product_id        uuid not null references public.products(id),
  variant_id        uuid,
  batch_id          uuid,
  system_quantity   numeric not null default 0,
  counted_quantity  numeric,
  unit              text,
  notes             text
);

create index if not exists idx_stock_count_items_count on public.stock_count_items(count_id);

alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;

create policy "members can view stock counts"
  on public.stock_counts for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert stock counts"
  on public.stock_counts for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update stock counts"
  on public.stock_counts for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "members can view stock count items"
  on public.stock_count_items for select
  to authenticated
  using (
    exists (
      select 1 from public.stock_counts c
      where c.id = count_id and is_business_member(c.business_id)
    )
  );

create policy "members can insert stock count items"
  on public.stock_count_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.stock_counts c
      where c.id = count_id and is_business_member(c.business_id)
    )
  );

create policy "members can update stock count items"
  on public.stock_count_items for update
  to authenticated
  using (
    exists (
      select 1 from public.stock_counts c
      where c.id = count_id and is_business_member(c.business_id)
    )
  )
  with check (
    exists (
      select 1 from public.stock_counts c
      where c.id = count_id and is_business_member(c.business_id)
    )
  );

drop trigger if exists set_stock_counts_updated_at on public.stock_counts;
create trigger set_stock_counts_updated_at before update on public.stock_counts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- stock_reservations
-- ---------------------------------------------------------------------------
create table if not exists public.stock_reservations (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  product_id     uuid not null references public.products(id),
  variant_id     uuid,
  batch_id       uuid,
  warehouse_id   uuid,
  location_id    uuid,
  quantity       numeric not null,
  status         text not null default 'open',
  reference_type text not null,
  reference_id   text not null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_stock_reservations_business on public.stock_reservations(business_id, status);
create index if not exists idx_stock_reservations_ref on public.stock_reservations(business_id, reference_type, reference_id);

alter table public.stock_reservations enable row level security;

create policy "members can view stock reservations"
  on public.stock_reservations for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert stock reservations"
  on public.stock_reservations for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update stock reservations"
  on public.stock_reservations for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

drop trigger if exists set_stock_reservations_updated_at on public.stock_reservations;
create trigger set_stock_reservations_updated_at before update on public.stock_reservations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- product_serials
-- ---------------------------------------------------------------------------
create table if not exists public.product_serials (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  product_id           uuid not null references public.products(id) on delete cascade,
  variant_id           uuid,
  serial_no            text not null,
  imei                 text,
  warranty_months      integer,
  warranty_expires_on  date,
  warehouse_id         uuid,
  location_id          uuid,
  batch_id             uuid,
  status               text not null default 'in_stock',
  reference_type       text,
  reference_id         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (business_id, serial_no)
);

create index if not exists idx_product_serials_product on public.product_serials(business_id, product_id);

alter table public.product_serials enable row level security;

create policy "members can view product serials"
  on public.product_serials for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert product serials"
  on public.product_serials for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update product serials"
  on public.product_serials for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

drop trigger if exists set_product_serials_updated_at on public.product_serials;
create trigger set_product_serials_updated_at before update on public.product_serials
  for each row execute function set_updated_at();
