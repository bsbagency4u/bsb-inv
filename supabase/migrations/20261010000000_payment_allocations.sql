-- Party ledger: payment vouchers, cancel/reverse without deleting history,
-- and multi-invoice allocations as the shared outstanding source of truth.

alter table public.payments
  add column if not exists document_no text,
  add column if not exists status text not null default 'posted',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id);

create index if not exists idx_payments_party
  on public.payments(business_id, party_type, party_id);

create index if not exists idx_payments_status
  on public.payments(business_id, status);

create index if not exists idx_payments_document_no
  on public.payments(business_id, document_no);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  sales_invoice_id uuid references public.sales_invoices(id) on delete set null,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint payment_allocations_one_invoice check (
    (sales_invoice_id is not null and purchase_invoice_id is null)
    or (sales_invoice_id is null and purchase_invoice_id is not null)
  ),
  constraint payment_allocations_positive check (amount > 0)
);

create index if not exists idx_payment_allocations_business
  on public.payment_allocations(business_id);

create index if not exists idx_payment_allocations_payment
  on public.payment_allocations(payment_id);

create index if not exists idx_payment_allocations_sales
  on public.payment_allocations(sales_invoice_id);

create index if not exists idx_payment_allocations_purchase
  on public.payment_allocations(purchase_invoice_id);

alter table public.payment_allocations enable row level security;

create policy "members can view payment allocations"
  on public.payment_allocations for select
  to authenticated
  using (is_business_member(business_id));

create policy "members can create payment allocations"
  on public.payment_allocations for insert
  to authenticated
  with check (is_business_member(business_id));

create policy "members can update payment allocations"
  on public.payment_allocations for update
  to authenticated
  using (is_business_member(business_id))
  with check (is_business_member(business_id));

create policy "owners can delete payment allocations"
  on public.payment_allocations for delete
  to authenticated
  using (is_business_owner(business_id));

insert into public.payment_allocations (
  business_id,
  payment_id,
  sales_invoice_id,
  purchase_invoice_id,
  amount
)
select
  p.business_id,
  p.id,
  p.sales_invoice_id,
  p.purchase_invoice_id,
  p.amount
from public.payments p
where (p.sales_invoice_id is not null or p.purchase_invoice_id is not null)
  and not exists (
    select 1
    from public.payment_allocations a
    where a.payment_id = p.id
  );
