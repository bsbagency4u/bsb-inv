-- ============================================================================
-- BSB StockFlow — Phase 3 Part 1: Business transaction engine
--
-- Adds configurable payment modes, atomic document numbering, purchase
-- receiving, purchase/sales returns, and richer customer/supplier fields.
-- Stock-affecting transactions keep flowing through the stock ledger (the
-- authoritative inventory system built in Phase 2 Part 1).
--
-- RLS: business-scoped; select = members, write = owners for master data,
-- member inserts for transactions (staff record sales/receipts).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- payment_modes (configurable; not hard-coded in transaction logic)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_modes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code        text not null,
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, code)
);

create index if not exists idx_payment_modes_business on public.payment_modes(business_id);

alter table public.payment_modes enable row level security;

create policy "members can view payment modes"
  on public.payment_modes for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create payment modes"
  on public.payment_modes for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update payment modes"
  on public.payment_modes for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete payment modes"
  on public.payment_modes for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- document_sequences: atomic, business-specific document numbering
-- ---------------------------------------------------------------------------
create table if not exists public.document_sequences (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  kind         text not null, -- sales / purchase_order / purchase_invoice / sales_return / purchase_return
  prefix       text not null,
  last_number  bigint not null default 0,
  primary key (business_id, kind)
);

alter table public.document_sequences enable row level security;

create policy "members can view document sequences"
  on public.document_sequences for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create document sequences"
  on public.document_sequences for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update document sequences"
  on public.document_sequences for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

-- Atomically returns the next formatted document number for a business+kind.
-- Uses an upsert so concurrent requests can never produce a duplicate number.
create or replace function public.next_document_number(
  p_business uuid,
  p_kind text,
  p_prefix text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_number bigint;
  v_year integer := extract(year from current_date);
begin
  insert into public.document_sequences (business_id, kind, prefix, last_number)
  values (p_business, p_kind, p_prefix, 1)
  on conflict (business_id, kind)
  do update
    set last_number = public.document_sequences.last_number + 1,
        prefix = excluded.prefix
  returning last_number into v_number;

  return format('%s-%s-%s', upper(p_prefix), v_year, lpad(v_number::text, 6, '0'));
end;
$$;

grant execute on function public.next_document_number(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- purchase_receipts (receiving goods against a purchase order)
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_receipts (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  purchase_order_id  uuid references public.purchase_orders(id) on delete set null,
  warehouse_id       uuid references public.warehouses(id) on delete set null,
  location_id        uuid references public.stock_locations(id) on delete set null,
  receipt_no         text not null,
  received_at        date not null default current_date,
  notes              text,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  unique (business_id, receipt_no)
);

create index if not exists idx_purchase_receipts_business on public.purchase_receipts(business_id);
create index if not exists idx_purchase_receipts_po on public.purchase_receipts(purchase_order_id);

alter table public.purchase_receipts enable row level security;

create policy "members can view purchase receipts"
  on public.purchase_receipts for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create purchase receipts"
  on public.purchase_receipts for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update purchase receipts"
  on public.purchase_receipts for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete purchase receipts"
  on public.purchase_receipts for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.purchase_receipt_items (
  id               uuid primary key default gen_random_uuid(),
  receipt_id       uuid not null references public.purchase_receipts(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  variant_id       uuid references public.product_variants(id) on delete set null,
  quantity         numeric(14,2) not null default 0,
  unit_cost        numeric(14,2) not null default 0
);

create index if not exists idx_purchase_receipt_items_receipt on public.purchase_receipt_items(receipt_id);

alter table public.purchase_receipt_items enable row level security;

create policy "members can view purchase receipt items"
  on public.purchase_receipt_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.purchase_receipts where id = receipt_id)
  ));

create policy "members can create purchase receipt items"
  on public.purchase_receipt_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.purchase_receipts where id = receipt_id)
  ));

create policy "owners can delete purchase receipt items"
  on public.purchase_receipt_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_receipts where id = receipt_id)
  ));

-- ---------------------------------------------------------------------------
-- purchase_returns (stock OUT; supplier credit/refund)
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_returns (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  purchase_invoice_id  uuid references public.purchase_invoices(id) on delete set null,
  supplier_id          uuid references public.suppliers(id) on delete set null,
  return_no            text not null,
  return_date          date not null default current_date,
  reason               text,
  total                numeric(14,2) not null default 0,
  notes                text,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  unique (business_id, return_no)
);

create index if not exists idx_purchase_returns_business on public.purchase_returns(business_id);

alter table public.purchase_returns enable row level security;

create policy "members can view purchase returns"
  on public.purchase_returns for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create purchase returns"
  on public.purchase_returns for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update purchase returns"
  on public.purchase_returns for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete purchase returns"
  on public.purchase_returns for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.purchase_return_items (
  id         uuid primary key default gen_random_uuid(),
  return_id  uuid not null references public.purchase_returns(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity   numeric(14,2) not null default 0,
  unit_cost  numeric(14,2) not null default 0
);

create index if not exists idx_purchase_return_items_return on public.purchase_return_items(return_id);

alter table public.purchase_return_items enable row level security;

create policy "members can view purchase return items"
  on public.purchase_return_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.purchase_returns where id = return_id)
  ));

create policy "members can create purchase return items"
  on public.purchase_return_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.purchase_returns where id = return_id)
  ));

create policy "owners can delete purchase return items"
  on public.purchase_return_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_returns where id = return_id)
  ));

-- ---------------------------------------------------------------------------
-- sales_returns (stock IN; refund / customer credit)
-- ---------------------------------------------------------------------------
create table if not exists public.sales_returns (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  sales_invoice_id uuid references public.sales_invoices(id) on delete set null,
  customer_id      uuid references public.customers(id) on delete set null,
  return_no        text not null,
  return_date      date not null default current_date,
  reason           text,
  total            numeric(14,2) not null default 0,
  notes            text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  unique (business_id, return_no)
);

create index if not exists idx_sales_returns_business on public.sales_returns(business_id);

alter table public.sales_returns enable row level security;

create policy "members can view sales returns"
  on public.sales_returns for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create sales returns"
  on public.sales_returns for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update sales returns"
  on public.sales_returns for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete sales returns"
  on public.sales_returns for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.sales_return_items (
  id         uuid primary key default gen_random_uuid(),
  return_id  uuid not null references public.sales_returns(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity   numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0
);

create index if not exists idx_sales_return_items_return on public.sales_return_items(return_id);

alter table public.sales_return_items enable row level security;

create policy "members can view sales return items"
  on public.sales_return_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.sales_returns where id = return_id)
  ));

create policy "members can create sales return items"
  on public.sales_return_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.sales_returns where id = return_id)
  ));

create policy "owners can delete sales return items"
  on public.sales_return_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.sales_returns where id = return_id)
  ));

-- ---------------------------------------------------------------------------
-- Extend customers
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists country      text,
  add column if not exists pan          text,
  add column if not exists customer_type text not null default 'regular',
  add column if not exists credit_limit numeric(14,2),
  add column if not exists notes        text;

-- ---------------------------------------------------------------------------
-- Extend suppliers
-- ---------------------------------------------------------------------------
alter table public.suppliers
  add column if not exists country       text,
  add column if not exists pan           text,
  add column if not exists payment_terms text,
  add column if not exists notes         text;

-- ---------------------------------------------------------------------------
-- Extend purchase_orders with a receiving warehouse
-- ---------------------------------------------------------------------------
alter table public.purchase_orders
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at triggers for new tables
-- ---------------------------------------------------------------------------
drop trigger if exists set_payment_modes_updated_at on public.payment_modes;
create trigger set_payment_modes_updated_at before update on public.payment_modes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default payment modes for all businesses (new and existing)
-- ---------------------------------------------------------------------------
insert into public.payment_modes (business_id, code, name, sort_order)
select b.id, defaults.code, defaults.name, defaults.sort_order
from public.businesses b
cross join (values
  ('cash', 'Cash', 10),
  ('upi', 'UPI', 20),
  ('card', 'Card', 30),
  ('bank_transfer', 'Bank Transfer', 40),
  ('credit', 'Credit', 50),
  ('other', 'Other', 60)
) as defaults(code, name, sort_order)
on conflict (business_id, code) do nothing;

-- Also seed defaults when a new business is created
create or replace function public.seed_business_transaction_defaults()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.payment_modes (business_id, code, name, sort_order)
  select new.id, defaults.code, defaults.name, defaults.sort_order
  from (values
    ('cash', 'Cash', 10),
    ('upi', 'UPI', 20),
    ('card', 'Card', 30),
    ('bank_transfer', 'Bank Transfer', 40),
    ('credit', 'Credit', 50),
    ('other', 'Other', 60)
  ) as defaults(code, name, sort_order)
  on conflict (business_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_transaction_defaults_on_business on public.businesses;
create trigger seed_transaction_defaults_on_business
  after insert on public.businesses
  for each row execute function public.seed_business_transaction_defaults();
