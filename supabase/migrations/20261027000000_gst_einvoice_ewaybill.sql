-- E-Invoice (IRN) and E-Way Bill storage.
--
-- Official IRN / signed QR / EWB numbers live in tenant-scoped tables, not on
-- sales invoice headers, so invoice create/update cannot invent or wipe them.
-- Credentials are encrypted at rest; the browser never reads the secret.

-- ---------------------------------------------------------------------------
-- gst_irp_credentials (one row per business)
-- ---------------------------------------------------------------------------
create table if not exists public.gst_irp_credentials (
  business_id       uuid primary key references public.businesses(id) on delete cascade,
  provider          text not null default 'nic',
  environment       text not null default 'sandbox',
  gstin             text,
  username          text,
  secret_ciphertext text,
  secret_iv         text,
  last_validated_at timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.gst_irp_credentials is
  'Encrypted IRP/GSP credentials. Secret ciphertext is never selected by the browser client.';

alter table public.gst_irp_credentials enable row level security;

create policy "members can view irp credential metadata"
  on public.gst_irp_credentials for select
  to authenticated
  using (is_business_member(business_id));

create policy "owners can insert irp credentials"
  on public.gst_irp_credentials for insert
  to authenticated
  with check (is_business_owner(business_id));

create policy "owners can update irp credentials"
  on public.gst_irp_credentials for update
  to authenticated
  using (is_business_owner(business_id))
  with check (is_business_owner(business_id));

create policy "owners can delete irp credentials"
  on public.gst_irp_credentials for delete
  to authenticated
  using (is_business_owner(business_id));

drop trigger if exists set_gst_irp_credentials_updated_at on public.gst_irp_credentials;
create trigger set_gst_irp_credentials_updated_at before update on public.gst_irp_credentials
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- gst_einvoices
-- ---------------------------------------------------------------------------
create table if not exists public.gst_einvoices (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  document_kind   text not null,
  document_id     uuid not null,
  document_no     text not null,
  document_date   date not null,
  status          text not null default 'pending',
  irn             text,
  ack_no          text,
  ack_date        timestamptz,
  signed_qr_code  text,
  cancel_reason   text,
  cancelled_at    timestamptz,
  last_error      text,
  request_hash    text,
  payload         jsonb not null default '{}'::jsonb,
  response        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, document_kind, document_id)
);

comment on table public.gst_einvoices is
  'Official IRN / signed QR stored only after a verified IRP response.';

comment on column public.gst_einvoices.irn is
  'Invoice Reference Number returned by the IRP. Never generated locally.';

create unique index if not exists idx_gst_einvoices_irn
  on public.gst_einvoices(business_id, irn)
  where irn is not null;

create index if not exists idx_gst_einvoices_business_status
  on public.gst_einvoices(business_id, status, document_date);

alter table public.gst_einvoices enable row level security;

create policy "members can view einvoices"
  on public.gst_einvoices for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert einvoices"
  on public.gst_einvoices for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update einvoices"
  on public.gst_einvoices for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

drop trigger if exists set_gst_einvoices_updated_at on public.gst_einvoices;
create trigger set_gst_einvoices_updated_at before update on public.gst_einvoices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- gst_eway_bills
-- ---------------------------------------------------------------------------
create table if not exists public.gst_eway_bills (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  document_kind   text not null,
  document_id     uuid not null,
  document_no     text not null,
  document_date   date not null,
  status          text not null default 'pending',
  ewb_no          text,
  ewb_date        timestamptz,
  valid_upto      timestamptz,
  trans_mode      text,
  trans_doc_no    text,
  trans_doc_date  date,
  vehicle_no      text,
  trans_distance  numeric(12,2),
  from_place      text,
  to_place        text,
  cancel_reason   text,
  cancelled_at    timestamptz,
  last_error      text,
  request_hash    text,
  payload         jsonb not null default '{}'::jsonb,
  response        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, document_kind, document_id)
);

comment on table public.gst_eway_bills is
  'Official e-way bill numbers stored only after a verified NIC/GSP response.';

create unique index if not exists idx_gst_eway_bills_no
  on public.gst_eway_bills(business_id, ewb_no)
  where ewb_no is not null;

create index if not exists idx_gst_eway_bills_business_status
  on public.gst_eway_bills(business_id, status, document_date);

alter table public.gst_eway_bills enable row level security;

create policy "members can view eway bills"
  on public.gst_eway_bills for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert eway bills"
  on public.gst_eway_bills for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update eway bills"
  on public.gst_eway_bills for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

drop trigger if exists set_gst_eway_bills_updated_at on public.gst_eway_bills;
create trigger set_gst_eway_bills_updated_at before update on public.gst_eway_bills
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- gst_compliance_attempts (idempotent submit log)
-- ---------------------------------------------------------------------------
create table if not exists public.gst_compliance_attempts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  kind            text not null,
  document_kind   text not null,
  document_id     uuid not null,
  action          text not null,
  status          text not null default 'queued',
  request_hash    text,
  error           text,
  response        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_gst_compliance_attempts_doc
  on public.gst_compliance_attempts(business_id, kind, document_kind, document_id, created_at desc);

alter table public.gst_compliance_attempts enable row level security;

create policy "members can view compliance attempts"
  on public.gst_compliance_attempts for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can insert compliance attempts"
  on public.gst_compliance_attempts for insert
  to authenticated
  with check (is_business_member(business_id));
