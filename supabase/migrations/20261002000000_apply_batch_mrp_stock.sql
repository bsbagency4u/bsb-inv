-- Apply batch MRP / purchase-price schema that live databases missed
-- from 20260921000000_batch_mrp_stock. Idempotent.
-- Root cause of purchase save failure: product_batches.purchase_price
-- is referenced by createBatch but was never added on production.

alter table public.product_batches
  add column if not exists purchase_price numeric(14,2);

create index if not exists idx_stock_ledger_batch on public.stock_ledger(business_id, batch_id);

drop policy if exists "owners can create product batches" on public.product_batches;
drop policy if exists "owners can update product batches" on public.product_batches;
drop policy if exists "members can create product batches" on public.product_batches;
drop policy if exists "members can update product batches" on public.product_batches;

create policy "members can create product batches"
  on public.product_batches for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update product batches"
  on public.product_batches for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create or replace view public.stock_balances
with (security_invoker = true)
as
select
  business_id,
  product_id,
  variant_id,
  batch_id,
  warehouse_id,
  location_id,
  sum(change) as quantity,
  max(created_at) as last_movement_at
from public.stock_ledger
group by business_id, product_id, variant_id, batch_id, warehouse_id, location_id;
