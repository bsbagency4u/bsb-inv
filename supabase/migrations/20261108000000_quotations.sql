-- Quotations: commercial offers that never post sales, stock, or finance.
-- Convert-to-invoice uses the existing sales invoice engine once.

-- ---------------------------------------------------------------------------
-- quotations
-- ---------------------------------------------------------------------------
create table if not exists public.quotations (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses(id) on delete cascade,
  quotation_no                text not null,
  customer_id                 uuid references public.customers(id) on delete set null,
  party_name                  text not null default '',
  party_gstin                 text,
  party_phone                 text,
  party_email                 text,
  quotation_date              date not null default current_date,
  valid_until                 date,
  status                      text not null default 'draft',
  format                      text not null default 'product_service',
  template_id                 text,
  title                       text,
  intro                       text,
  scope                       text,
  timeline                    text,
  assumptions                 text,
  terms_and_conditions        text,
  notes                       text,
  subtotal                    numeric(14,2) not null default 0,
  discount                    numeric(14,2) not null default 0,
  tax_total                   numeric(14,2) not null default 0,
  total                       numeric(14,2) not null default 0,
  intra_state                 boolean not null default true,
  place_of_supply_state       text,
  gst_registration_snapshot   text,
  converted_sales_invoice_id  uuid references public.sales_invoices(id) on delete set null,
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (business_id, quotation_no),
  constraint quotations_status_check check (
    status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled')
  ),
  constraint quotations_format_check check (
    format in ('formal_proposal', 'product_service')
  )
);

create index if not exists idx_quotations_business on public.quotations(business_id);
create index if not exists idx_quotations_customer on public.quotations(customer_id);
create index if not exists idx_quotations_date on public.quotations(business_id, quotation_date);
create index if not exists idx_quotations_status on public.quotations(business_id, status);

alter table public.quotations enable row level security;

create policy "members can view quotations"
  on public.quotations for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create quotations"
  on public.quotations for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update quotations"
  on public.quotations for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "owners can delete quotations"
  on public.quotations for delete
  to authenticated
  using (is_business_owner(business_id));

drop trigger if exists set_quotations_updated_at on public.quotations;
create trigger set_quotations_updated_at before update on public.quotations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- quotation_items
-- ---------------------------------------------------------------------------
create table if not exists public.quotation_items (
  id                uuid primary key default gen_random_uuid(),
  quotation_id      uuid not null references public.quotations(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  name              text not null default '',
  description       text,
  sku               text,
  hsn               text,
  quantity          numeric(14,2) not null default 1,
  unit              text,
  unit_price        numeric(14,2) not null default 0,
  gst_rate          numeric(5,2) not null default 0,
  discount          numeric(14,2) not null default 0,
  taxable_amount    numeric(14,2) not null default 0,
  tax_amount        numeric(14,2) not null default 0,
  amount            numeric(14,2) not null default 0,
  gst_supply_type   text,
  sort_order        integer not null default 0
);

create index if not exists idx_quotation_items_quotation on public.quotation_items(quotation_id);

alter table public.quotation_items enable row level security;

create policy "members can view quotation items"
  on public.quotation_items for select
  to authenticated
  using (is_business_member(
    (select business_id from public.quotations where id = quotation_id)
  ));

create policy "members can create quotation items"
  on public.quotation_items for insert
  to authenticated
  with check (is_business_member(
    (select business_id from public.quotations where id = quotation_id)
  ));

create policy "members can update quotation items"
  on public.quotation_items for update
  to authenticated
  using (is_business_member(
    (select business_id from public.quotations where id = quotation_id)
  ))
  with check (is_business_member(
    (select business_id from public.quotations where id = quotation_id)
  ));

create policy "members can delete quotation items"
  on public.quotation_items for delete
  to authenticated
  using (is_business_member(
    (select business_id from public.quotations where id = quotation_id)
  ));

-- ---------------------------------------------------------------------------
-- Private storage for logos, watermarks, signatures and stamps.
-- Paths are {business_id}/quotation/... — never public.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('business-documents', 'business-documents', false)
on conflict (id) do nothing;

create policy "members can read business documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'business-documents'
    and is_business_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members can upload business documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'business-documents'
    and is_business_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members can update business documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'business-documents'
    and is_business_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'business-documents'
    and is_business_member(((storage.foldername(name))[1])::uuid)
  );

create policy "owners can delete business documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'business-documents'
    and is_business_owner(((storage.foldername(name))[1])::uuid)
  );
