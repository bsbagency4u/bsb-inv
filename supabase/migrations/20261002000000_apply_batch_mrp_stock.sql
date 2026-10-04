-- Apply batch MRP / purchase-price schema that live databases missed
-- from 20260921000000_batch_mrp_stock. Idempotent.
-- Root cause of purchase save failure: product_batches.purchase_price
-- is referenced by createBatch but was never added on production.
--
-- stock_balances currently exists as:
--   business_id, product_id, variant_id, warehouse_id, location_id, quantity, last_movement_at
-- CREATE OR REPLACE VIEW cannot insert batch_id before warehouse_id (Postgres 42P16
-- treats that as renaming warehouse_id). Append batch_id after the original columns.

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

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stock_balances'
      and column_name = 'batch_id'
  ) then
    execute $view$
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
        max(created_at) as last_movement_at,
        batch_id
      from public.stock_ledger
      group by business_id, product_id, variant_id, warehouse_id, location_id, batch_id
    $view$;
  end if;
end $$;
