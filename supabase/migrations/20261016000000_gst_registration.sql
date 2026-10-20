-- Configuration-driven GST registration and supply classification.
--
-- Adds an authoritative GST registration status to businesses and parties,
-- a supply classification to products, and immutable GST snapshots to sales
-- and purchase documents so historical invoices keep the tax treatment that
-- applied when they were issued (never re-derived from current master data).

-- ---------------------------------------------------------------------------
-- businesses: authoritative registration status
-- ---------------------------------------------------------------------------
alter table public.businesses
  add column if not exists gst_registration_type text not null default 'unregistered';

comment on column public.businesses.gst_registration_type is
  'Authoritative GST registration status: regular | composition | unregistered | sez | casual | isd.';

-- Seed from the existing GSTIN when present so registered businesses keep
-- charging tax after the migration runs.
update public.businesses
  set gst_registration_type = 'regular'
  where gstin is not null
    and btrim(gstin) <> ''
    and gst_registration_type = 'unregistered';

-- ---------------------------------------------------------------------------
-- customers: GST status + place of supply
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists gst_registration_type text not null default 'unregistered',
  add column if not exists place_of_supply_state text;

comment on column public.customers.gst_registration_type is
  'GST status: registered | composition | unregistered | sez | consumer | overseas.';

update public.customers
  set gst_registration_type = 'registered'
  where gstin is not null
    and btrim(gstin) <> ''
    and gst_registration_type = 'unregistered';

-- ---------------------------------------------------------------------------
-- suppliers: GST status
-- ---------------------------------------------------------------------------
alter table public.suppliers
  add column if not exists gst_registration_type text not null default 'unregistered',
  add column if not exists place_of_supply_state text;

update public.suppliers
  set gst_registration_type = 'registered'
  where gstin is not null
    and btrim(gstin) <> ''
    and gst_registration_type = 'unregistered';

-- ---------------------------------------------------------------------------
-- products: supply classification
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists gst_supply_type text,
  add column if not exists reverse_charge boolean not null default false;

-- Backfill from the legacy boolean: non-taxable products are treated as exempt.
update public.products
  set gst_supply_type = case when taxable then 'taxable' else 'exempt' end
  where gst_supply_type is null;

alter table public.products
  alter column gst_supply_type set default 'taxable';

-- ---------------------------------------------------------------------------
-- sales_invoices: GST document snapshot
-- ---------------------------------------------------------------------------
alter table public.sales_invoices
  add column if not exists gst_document_type text not null default 'tax_invoice',
  add column if not exists place_of_supply_state text,
  add column if not exists gst_registration_snapshot text,
  add column if not exists intra_state boolean not null default true,
  add column if not exists reverse_charge boolean not null default false;

comment on column public.sales_invoices.gst_document_type is
  'Document snapshot: tax_invoice | bill_of_supply | commercial_invoice | export_invoice.';

comment on column public.sales_invoices.gst_registration_snapshot is
  'Registration status of the supplier at the time of issue; never re-derived.';

alter table public.sales_invoice_items
  add column if not exists gst_supply_type text,
  add column if not exists hsn text;

-- ---------------------------------------------------------------------------
-- purchase_invoices: GST document snapshot
-- ---------------------------------------------------------------------------
alter table public.purchase_invoices
  add column if not exists gst_document_type text not null default 'tax_invoice',
  add column if not exists place_of_supply_state text,
  add column if not exists supplier_gstin text,
  add column if not exists gst_registration_snapshot text,
  add column if not exists intra_state boolean not null default true,
  add column if not exists reverse_charge boolean not null default false,
  add column if not exists itc_eligible boolean not null default true;

comment on column public.purchase_invoices.itc_eligible is
  'Whether input tax credit is expected on this bill; never assumed claimed.';

alter table public.purchase_invoice_items
  add column if not exists gst_supply_type text,
  add column if not exists hsn text,
  add column if not exists itc_eligible boolean not null default false,
  add column if not exists discount numeric(14,2) not null default 0,
  add column if not exists taxable_amount numeric(14,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0;

comment on column public.purchase_invoice_items.itc_eligible is
  'Whether ITC is expected on this line; defaults to false until tax is charged.';

-- ---------------------------------------------------------------------------
-- Helpful indexes for the GST reports centre
-- ---------------------------------------------------------------------------
create index if not exists idx_sales_invoices_gst_doc
  on public.sales_invoices(business_id, gst_document_type, invoice_date);

create index if not exists idx_purchase_invoices_gst_doc
  on public.purchase_invoices(business_id, gst_document_type, invoice_date);
