# BSB StockFlow

Multi-business inventory & billing ERP for Indian SMEs. Phases 1–3 are
shipped: foundation, inventory engine, sales/POS, purchases, GST, and
transaction numbering. Remaining work (users/roles, barcode, print/PDF,
offline) is tracked in `CHECKLIST.md`.

## Stack

- Next.js 16 (App Router, Turbopack, React 19, TypeScript)
- Tailwind CSS v4 design system (`src/components/ui/`)
- Supabase (Postgres + Auth + RLS) — optional at runtime
- TanStack Query, React Hook Form + Zod, Vitest

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials the app runs in
**demo mode** — a clearly-marked local session with sample data kept in the
browser. No backend required.

## Configuration

Copy `.env.example` to `.env.local` and set the public Supabase project URL and
anon key to enable real accounts and persistence:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, optional
```

Apply the database schema and seed:

```bash
supabase db push
supabase db seed --file supabase/seed/0001_roles_permissions.sql
```

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the development server         |
| `npm run build`    | Production build (Vercel-compatible) |
| `npm run start`    | Serve the production build           |
| `npm run lint`     | ESLint                               |
| `npm run typecheck`| TypeScript (`tsc --noEmit`)          |
| `npm test`         | Vitest unit tests                    |

## Architecture

- **Repositories** (`src/repositories/`) are the only layer that talks to
  Supabase; a local/demo implementation swaps in when Supabase is unconfigured.
  UI never queries Supabase directly — it always goes through services.
- **Services** (`src/services/`) hold business logic (validation, audit logs,
  stock ledger, GST, transactions, auth).
- **Multi-business**: records carry `business_id`, RLS scopes rows to members,
  owners write; the shell includes a business switcher.
- **Future modules** render via a config-driven catch-all placeholder
  ("Coming Soon"); adding a real page overrides the placeholder. See
  `src/config/modules.ts`. Remaining work: `CHECKLIST.md`.

## Shipped

### Phase 1 — Foundation

- Auth (sign in / sign up, demo session) + `proxy.ts` session check
- Business profile + onboarding + settings (business/system)
- User profile, app shell, global search (⌘K), notifications, business switcher
- Supabase schema, RLS policies and seed (roles/permissions)

### Phase 2 — Inventory & operations

- Products (dynamic attributes per business type), categories, brands, units
- Warehouses, stock locations, stock ledger
- Customers, suppliers, POS, sales invoices, GST engine, reports

### Phase 3 — Transaction engine

- Purchase orders, receiving, purchase invoices, sales/purchase returns
- Payments, configurable payment modes, atomic document numbering
- Stock transfers page, sales/purchase defaults

## Next (Phase 4+)

Users & roles UI, tax/invoice settings, barcode, print/PDF, GSTR export,
multi-counter POS, offline/sync. See `CHECKLIST.md`.
