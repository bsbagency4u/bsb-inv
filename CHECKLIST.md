# BSB StockFlow — Remaining Work Checklist

**Always read this file before starting any task.** Find the first unchecked item, mark it `[~]` while working, then `[x]` when done. Update **Resume from** so the next session knows where to start.

| | |
| --- | --- |
| Last updated | 2026-09-17 |
| Git HEAD | `866fd8f` feat: build BSB StockFlow phase 3 transaction engine |
| Current phase | **Phase 4 — GST polish, barcode, team, settings** |
| **Resume from** | **Phase 4 item 5 — Printable / PDF sales invoice (P4-5)** |

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` cancelled / covered elsewhere

---

## How to use (do this first, every session)

1. Open `CHECKLIST.md`.
2. Start at **Resume from** (table above), not from the top of the file.
3. Work the first `[ ]` item in that section.
4. After finishing: check it `[x]`, set **Resume from** to the next `[ ]` item, bump **Last updated**.
5. Do not start Phase 5 until Phase 4 is complete unless the user asks otherwise.

---

## Current status (what is already built)

### Phase 1 — Foundation `[x]`

- [x] Auth (sign in / sign up) + demo session when Supabase is unset
- [x] `proxy.ts` session gate
- [x] App shell, sidebar, topbar, business switcher
- [x] Global search (⌘K) + notifications menu
- [x] Business onboarding + profile + settings (business / system)
- [x] User profile
- [x] Supabase schema + RLS + roles/permissions seed
- [x] Repository / service split (UI never talks to Supabase)
- [x] Design system (`src/components/ui/`)

### Phase 2 — Inventory & operations `[x]`

- [x] Products (dynamic attributes per business type, variants, images)
- [x] Categories, brands, units
- [x] Warehouses + stock locations (`/inventory/warehouses`)
- [x] Stock ledger (opening / adjust / transfer / scrap) — `/inventory/stock`
- [x] Customers + suppliers
- [x] POS + sales invoices
- [x] GST engine (CGST+SGST intra-state, IGST inter-state)
- [x] Reports: sales / stock / GST summary (`/reports`)
- [x] Dashboard stats from real repository data
- [x] Search providers: product, customer, supplier, invoice, purchase, stock
- [x] Batches API in product repository/service (no dedicated UI yet)

### Phase 3 — Transaction engine `[x]` (core)

- [x] Sales invoices: create, pay, cancel, stock OUT
- [x] POS checkout with payment mode + amount
- [x] Purchase orders + goods receiving (stock IN)
- [x] Purchase invoices (bill + stock IN)
- [x] Sales returns (stock IN) + purchase returns (stock OUT)
- [x] Payments in/out, partial / paid / unpaid
- [x] Configurable payment modes (`/settings/payments`)
- [x] Atomic document numbering (`document_sequences`)
- [x] Migration `supabase/migrations/20260818000000_phase3_transactions.sql`

---

## Next up — Phase 3 leftovers (do these before Phase 4)

These are placeholders or stale labels left after Phase 3 shipped.

- [x] **P3-1** Dedicated Stock Transfers page at `/inventory/transfers` (service `inventory.transferStock` already exists; stock page already transfers). Either ship a real page or drop the Coming Soon placeholder and point nav at `/inventory/stock`.
- [x] **P3-2** Settings → Sales defaults (`/settings/sales`): discount rules, default payment mode, POS defaults.
- [x] **P3-3** Settings → Purchase defaults (`/settings/purchase`): vendor payment terms, default warehouse.
- [x] **P3-4** Mark Payments as available on the settings overview (`src/app/(app)/settings/page.tsx` still has `available: false` even though `/settings/payments` works).
- [x] **P3-5** Stale copy: System settings still says `Phase 1 — Foundation`; README still describes Phase 1 as current and says POS/GST ship later. Bring both in line with Phase 3.

**After P3-5:** set **Resume from** to `Phase 4 item 1 — Users & Roles`.

---

## Phase 4 — GST polish, barcode, team, settings

Placeholders live in `src/config/modules.ts` (`MODULE_PLACEHOLDERS` + `SETTINGS_PLACEHOLDERS`). Adding a real page file automatically overrides the catch-all.

### Team & access

- [x] **P4-1** Users & Roles UI (`/settings/users`): invite members, assign roles, permissions. Schema/seed already has roles & permissions (`supabase/seed/0001_roles_permissions.sql`). Added `TeamRepository` (supabase + local), `TeamService`, invitation table (`20260819000000_phase4_team.sql`), co-member profile RLS and a members / roles-permissions page.
- [x] **P4-2** Enforce role permissions in services (not only RLS/owner checks). Added `AuthorizationService` (`requirePermission`/`can`, owner `"*"` wildcard), `TeamRepository.getMemberPermissions` (supabase + local), and permission-slug checks in product / inventory / party / business / transaction / payment-mode services; one shared `AuthorizationService` is wired in `src/services/index.ts`.

### Tax & invoicing

- [x] **P4-3** Tax settings (`/settings/tax`): default GST rates, intra/inter-state rules, HSN defaults. Added `TaxDefaults` type + `taxDefaultsSchema`, `BusinessService.getTaxDefaults`/`updateTaxDefaults` (`settings.manage`, audited), `GST_RATE_OPTIONS`, and the `/settings/tax` page; placeholder removed and settings overview marked available.
- [x] **P4-4** Invoice settings (`/settings/invoice`): templates, prefix/numbering UI (sequences already exist), GST layout, print/PDF. Added `InvoiceDefaults` + `invoiceDefaultsSchema`/`invoiceNumberingSchema`, `BusinessService.getInvoiceDefaults`/`updateInvoiceDefaults`/`updateInvoiceNumbering` (`settings.manage`, audited), `/settings/invoice` page (numbering + layout/print), placeholder removed and settings overview marked available.
- [ ] **P4-5** Printable / PDF sales invoice (and purchase bill) from invoice detail.

### Inventory extras

- [ ] **P4-6** Barcode generation + scanning (`/inventory/barcode`). Products already store `barcode`.
- [ ] **P4-7** Inventory settings (`/settings/inventory`): low-stock thresholds, default units, track-inventory defaults.
- [ ] **P4-8** Warehouse settings page (`/settings/warehouses`) — either real settings or redirect to `/inventory/warehouses` and remove the placeholder.
- [ ] **P4-9** Batch / expiry UI (pharmacy attributes + `listBatches` / `createBatch` already exist; no page).
- [ ] **P4-10** Notification rules (`/settings/notifications`): low-stock, expiry, payment-due, failed-transaction alerts. Create API exists; rules/scheduler do not.

### Reports (beyond the three tabs already shipped)

- [ ] **P4-11** Purchase report, outstanding / receivables / payables.
- [ ] **P4-12** GSTR-style export (GSTR-1 / GSTR-3B summaries from existing GST lines).

---

## Phase 5 — POS scale, offline, backup

- [ ] **P5-1** Multi-counter POS (`/settings/counters`).
- [ ] **P5-2** Backup / restore / export (`/settings/backup`).
- [ ] **P5-3** Offline mode + sync (local repositories in `src/repositories/local/` are the intended foundation).
- [ ] **P5-4** Failed-transaction retry / queue for offline POS.

---

## Known mismatches (fix during leftovers)

| Location | Issue |
| --- | --- |
| `src/config/modules.ts` | Phase 3 placeholders for transfers/sales/purchase removed |
| `src/app/(app)/settings/page.tsx` | Payments, Sales, Purchase marked available |
| `src/app/(app)/settings/system/page.tsx` | Phase label updated to `"3 — Transaction engine"` |
| `README.md` | Updated to Phases 1–3 shipped |
| `src/config/navigation.ts` | Transfers href `/inventory/transfers` now has a real page |
| `src/config/modules.ts` | `/settings/users`, `/settings/tax`, `/settings/invoice` placeholders removed (real pages now) |
| `src/app/(app)/settings/page.tsx` | Users & roles, Tax, Invoice marked available |

---

## Architecture reminders (do not regress)

- UI → services → repositories. Never query Supabase from components.
- Stock is append-only ledger; current qty = sum of movements. All stock-affecting paths go through `InventoryService`.
- GST is pure (`GstEngine`); keep it free of I/O.
- Demo mode (no env) must keep working with local repositories.
- Catch-all `src/app/(app)/[...module]/page.tsx` only renders entries in `MODULE_PLACEHOLDERS`; unknown paths 404.
- New settings pages: add a real `page.tsx`, remove the `SETTINGS_PLACEHOLDERS` entry, set `available: true` on the overview.

---

## Suggested first task next session

**P4-5** — Printable / PDF sales invoice (and purchase bill) from invoice detail. Read `InvoiceDefaults` from `BusinessService.getInvoiceDefaults` and render a print layout that respects logo / GSTIN / HSN / bank / terms / paper size. Keep `GstEngine` pure.
