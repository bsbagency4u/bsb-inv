-- ============================================================================
-- BSB StockFlow — Phase 2 operations schema
--
-- Products (dynamic attributes), categories, customers, suppliers, batches,
-- stock ledger, purchase orders/invoices, sales invoices, payments and
-- notifications. Multi-business aware like Phase 1.
--
-- RLS: every table is business-scoped. Select = members, write = owners for
-- master data; transactions allow member inserts (staff record sales) but
-- updates/deletes stay owner-only. No universal anonymous write policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  description text,
  parent_id   uuid references public.categories(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, name)
);

create index if not exists idx_categories_business on public.categories(business_id);

alter table public.categories enable row level security;

create policy "members can view categories"
  on public.categories for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create categories"
  on public.categories for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update categories"
  on public.categories for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete categories"
  on public.categories for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  name                 text not null,
  sku                  text,
  barcode              text,
  category_id          uuid references public.categories(id) on delete set null,
  unit                 text not null default 'pcs',
  attributes           jsonb not null default '{}'::jsonb,
  gst_rate             numeric(5,2) not null default 0,
  hsn                  text,
  purchase_price       numeric(14,2) not null default 0,
  sale_price           numeric(14,2) not null default 0,
  mrp                  numeric(14,2),
  low_stock_threshold  numeric(12,2) not null default 0,
  is_active            boolean not null default true,
  created_by           uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (business_id, sku)
);

create index if not exists idx_products_business on public.products(business_id);
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active on public.products(business_id, is_active);

alter table public.products enable row level security;

create policy "members can view products"
  on public.products for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create products"
  on public.products for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update products"
  on public.products for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete products"
  on public.products for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- product_batches (batch / expiry tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.product_batches (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  batch_no    text not null,
  expiry_date date,
  mrp         numeric(14,2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, batch_no)
);

create index if not exists idx_product_batches_business on public.product_batches(business_id);
create index if not exists idx_product_batches_product on public.product_batches(product_id);

alter table public.product_batches enable row level security;

create policy "members can view product batches"
  on public.product_batches for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create product batches"
  on public.product_batches for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update product batches"
  on public.product_batches for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete product batches"
  on public.product_batches for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  phone            text,
  email            text,
  gstin            text,
  address          text,
  city             text,
  state            text,
  pincode          text,
  opening_balance  numeric(14,2) not null default 0,
  is_active        boolean not null default true,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_customers_business on public.customers(business_id);

alter table public.customers enable row level security;

create policy "members can view customers"
  on public.customers for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create customers"
  on public.customers for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update customers"
  on public.customers for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete customers"
  on public.customers for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  phone            text,
  email            text,
  gstin            text,
  address          text,
  city             text,
  state            text,
  pincode          text,
  opening_balance  numeric(14,2) not null default 0,
  is_active        boolean not null default true,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_suppliers_business on public.suppliers(business_id);

alter table public.suppliers enable row level security;

create policy "members can view suppliers"
  on public.suppliers for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can create suppliers"
  on public.suppliers for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update suppliers"
  on public.suppliers for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete suppliers"
  on public.suppliers for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- stock_ledger (append-mostly; quantities are derived by summing)
-- ---------------------------------------------------------------------------
create table if not exists public.stock_ledger (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  batch_id       uuid references public.product_batches(id) on delete set null,
  change         numeric(14,2) not null default 0,
  reason         text not null default 'adjustment',
  reference_type text,
  reference_id   text,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_stock_ledger_business on public.stock_ledger(business_id);
create index if not exists idx_stock_ledger_product on public.stock_ledger(business_id, product_id);
create index if not exists idx_stock_ledger_reference on public.stock_ledger(reference_type, reference_id);

alter table public.stock_ledger enable row level security;

create policy "members can view stock ledger"
  on public.stock_ledger for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create stock ledger entries"
  on public.stock_ledger for insert
  to authenticated
  with check (is_business_member(business_id));

-- Stock movement view (security_invoker so RLS applies on the underlying rows)
create or replace view public.product_stock
with (security_invoker = true)
as
select
  business_id,
  product_id,
  sum(change) as quantity,
  max(created_at) as last_movement_at
from public.stock_ledger
group by business_id, product_id;

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  order_no       text not null,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  order_date     date not null default current_date,
  expected_date  date,
  status         text not null default 'draft',
  subtotal       numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  tax_total      numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, order_no)
);

create index if not exists idx_purchase_orders_business on public.purchase_orders(business_id);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);

alter table public.purchase_orders enable row level security;

create policy "members can view purchase orders"
  on public.purchase_orders for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create purchase orders"
  on public.purchase_orders for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update purchase orders"
  on public.purchase_orders for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete purchase orders"
  on public.purchase_orders for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  quantity           numeric(14,2) not null default 1,
  unit_price         numeric(14,2) not null default 0,
  gst_rate           numeric(5,2) not null default 0,
  amount             numeric(14,2) not null default 0,
  received_quantity  numeric(14,2) not null default 0
);

create index if not exists idx_po_items_order on public.purchase_order_items(purchase_order_id);

alter table public.purchase_order_items enable row level security;

create policy "members can view purchase order items"
  on public.purchase_order_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ));

create policy "members can create purchase order items"
  on public.purchase_order_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ));

create policy "owners can update purchase order items"
  on public.purchase_order_items for update
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ))
  with check (is_business_owner(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ));

create policy "owners can delete purchase order items"
  on public.purchase_order_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_orders where id = purchase_order_id)
  ));

-- ---------------------------------------------------------------------------
-- purchase_invoices (bills received from suppliers)
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  bill_no        text not null,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  invoice_date   date not null default current_date,
  due_date       date,
  status         text not null default 'pending',
  subtotal       numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  tax_total      numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  paid_amount    numeric(14,2) not null default 0,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, bill_no)
);

create index if not exists idx_purchase_invoices_business on public.purchase_invoices(business_id);
create index if not exists idx_purchase_invoices_supplier on public.purchase_invoices(supplier_id);

alter table public.purchase_invoices enable row level security;

create policy "members can view purchase invoices"
  on public.purchase_invoices for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create purchase invoices"
  on public.purchase_invoices for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update purchase invoices"
  on public.purchase_invoices for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete purchase invoices"
  on public.purchase_invoices for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.purchase_invoice_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  product_id          uuid references public.products(id) on delete set null,
  batch_id            uuid references public.product_batches(id) on delete set null,
  quantity            numeric(14,2) not null default 1,
  unit_price          numeric(14,2) not null default 0,
  gst_rate            numeric(5,2) not null default 0,
  amount              numeric(14,2) not null default 0
);

create index if not exists idx_pi_items_invoice on public.purchase_invoice_items(purchase_invoice_id);

alter table public.purchase_invoice_items enable row level security;

create policy "members can view purchase invoice items"
  on public.purchase_invoice_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.purchase_invoices where id = purchase_invoice_id)
  ));

create policy "members can create purchase invoice items"
  on public.purchase_invoice_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.purchase_invoices where id = purchase_invoice_id)
  ));

create policy "owners can update purchase invoice items"
  on public.purchase_invoice_items for update
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_invoices where id = purchase_invoice_id)
  ))
  with check (is_business_owner(
    (select business_id from public.purchase_invoices where id = purchase_invoice_id)
  ));

create policy "owners can delete purchase invoice items"
  on public.purchase_invoice_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.purchase_invoices where id = purchase_invoice_id)
  ));

-- ---------------------------------------------------------------------------
-- sales_invoices
-- ---------------------------------------------------------------------------
create table if not exists public.sales_invoices (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  invoice_no     text not null,
  customer_id    uuid references public.customers(id) on delete set null,
  invoice_date   date not null default current_date,
  due_date       date,
  status         text not null default 'finalized',
  subtotal       numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  tax_total      numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  paid_amount    numeric(14,2) not null default 0,
  payment_mode   text,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, invoice_no)
);

create index if not exists idx_sales_invoices_business on public.sales_invoices(business_id);
create index if not exists idx_sales_invoices_customer on public.sales_invoices(customer_id);
create index if not exists idx_sales_invoices_date on public.sales_invoices(business_id, invoice_date);

alter table public.sales_invoices enable row level security;

create policy "members can view sales invoices"
  on public.sales_invoices for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create sales invoices"
  on public.sales_invoices for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update sales invoices"
  on public.sales_invoices for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete sales invoices"
  on public.sales_invoices for delete
  to authenticated
  using (is_business_owner(business_id));

create table if not exists public.sales_invoice_items (
  id                uuid primary key default gen_random_uuid(),
  sales_invoice_id  uuid not null references public.sales_invoices(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  batch_id          uuid references public.product_batches(id) on delete set null,
  quantity          numeric(14,2) not null default 1,
  unit_price        numeric(14,2) not null default 0,
  gst_rate          numeric(5,2) not null default 0,
  discount          numeric(14,2) not null default 0,
  taxable_amount    numeric(14,2) not null default 0,
  tax_amount        numeric(14,2) not null default 0,
  amount            numeric(14,2) not null default 0
);

create index if not exists idx_si_items_invoice on public.sales_invoice_items(sales_invoice_id);

alter table public.sales_invoice_items enable row level security;

create policy "members can view sales invoice items"
  on public.sales_invoice_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.sales_invoices where id = sales_invoice_id)
  ));

create policy "members can create sales invoice items"
  on public.sales_invoice_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.sales_invoices where id = sales_invoice_id)
  ));

create policy "owners can update sales invoice items"
  on public.sales_invoice_items for update
  to authenticated
  using (is_business_owner(
    (select business_id from public.sales_invoices where id = sales_invoice_id)
  ))
  with check (is_business_owner(
    (select business_id from public.sales_invoices where id = sales_invoice_id)
  ));

create policy "owners can delete sales invoice items"
  on public.sales_invoice_items for delete
  to authenticated
  using (is_business_owner(
    (select business_id from public.sales_invoices where id = sales_invoice_id)
  ));

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  direction          text not null default 'in',
  party_type         text not null default 'customer',
  party_id           uuid,
  sales_invoice_id   uuid references public.sales_invoices(id) on delete set null,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  amount             numeric(14,2) not null default 0,
  mode               text not null default 'cash',
  reference          text,
  payment_date       date not null default current_date,
  notes              text,
  created_by         uuid references auth.users(id),
  created_at         timestamptz not null default now()
);

create index if not exists idx_payments_business on public.payments(business_id);
create index if not exists idx_payments_sales on public.payments(sales_invoice_id);
create index if not exists idx_payments_purchase on public.payments(purchase_invoice_id);

alter table public.payments enable row level security;

create policy "members can view payments"
  on public.payments for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create payments"
  on public.payments for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "owners can update payments"
  on public.payments for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete payments"
  on public.payments for delete
  to authenticated
  using (is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  type        text not null default 'info',
  href        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_business on public.notifications(business_id);
create index if not exists idx_notifications_user on public.notifications(business_id, user_id, read);

alter table public.notifications enable row level security;

create policy "members can view notifications"
  on public.notifications for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create notifications"
  on public.notifications for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update notifications"
  on public.notifications for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "members can delete notifications"
  on public.notifications for delete
  to authenticated
  using (is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- updated_at triggers for Phase 2 tables
-- ---------------------------------------------------------------------------
drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at before update on public.categories
  for each row execute function set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
  for each row execute function set_updated_at();

drop trigger if exists set_product_batches_updated_at on public.product_batches;
create trigger set_product_batches_updated_at before update on public.product_batches
  for each row execute function set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers
  for each row execute function set_updated_at();

drop trigger if exists set_suppliers_updated_at on public.suppliers;
create trigger set_suppliers_updated_at before update on public.suppliers
  for each row execute function set_updated_at();

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function set_updated_at();

drop trigger if exists set_purchase_invoices_updated_at on public.purchase_invoices;
create trigger set_purchase_invoices_updated_at before update on public.purchase_invoices
  for each row execute function set_updated_at();

drop trigger if exists set_sales_invoices_updated_at on public.sales_invoices;
create trigger set_sales_invoices_updated_at before update on public.sales_invoices
  for each row execute function set_updated_at();
