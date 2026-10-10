-- Configurable product packaging: base unit stock, optional pack unit.
-- Stock ledger remains in base units. Invoice lines keep commercial qty
-- and store the converted base_quantity used for stock IN/OUT.

alter table public.products
  add column if not exists pack_unit text,
  add column if not exists pack_unit_id uuid references public.units(id) on delete set null,
  add column if not exists units_per_pack numeric(14,4) not null default 1,
  add column if not exists min_sale_qty numeric(14,4) not null default 1,
  add column if not exists max_sale_qty numeric(14,4),
  add column if not exists allow_base_sale boolean not null default true,
  add column if not exists allow_pack_sale boolean not null default false;

create index if not exists idx_products_pack_unit on public.products(pack_unit_id);

do $$ begin
  alter table public.products
    add constraint products_units_per_pack_positive check (units_per_pack > 0);
exception
  when duplicate_object then null;
end $$;

alter table public.sales_invoice_items
  add column if not exists sale_unit text,
  add column if not exists base_quantity numeric(14,4);

alter table public.purchase_invoice_items
  add column if not exists sale_unit text,
  add column if not exists base_quantity numeric(14,4);
