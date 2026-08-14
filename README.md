# BSB StockFlow

Multi-business inventory & billing ERP for Indian SMEs. Phase 1 builds the
foundation: application shell, authentication, multi-business/Supabase-ready
architecture, design system, business setup, and dashboard/settings/profile.
Product, inventory, sales, POS and GST engine ship in later phases.

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
SUPABASE_SERVICE_ROLE_KEY=   # server-only, optional in Phase 1
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
  active-business persistence, auth).
- **Multi-business**: records carry `business_id`, RLS scopes rows to members,
  owners write; the shell includes a business switcher.
- **Future modules** render via a config-driven catch-all placeholder
  ("Coming Soon"); adding a real page overrides the placeholder. See
  `src/config/modules.ts`.

## Phase 1 scope

- Auth foundation (sign in / sign up, demo session) + `proxy.ts` session check
- Business profile + onboarding + settings (business/system)
- User profile, app shell, global search (⌘K), notifications, business switcher
- Supabase schema, RLS policies and seed (roles/permissions)

## Phase 2+ roadmap

Product master (dynamic attributes per business type), inventory, sales & POS,
purchases, invoicing + GST engine, reports, offline/sync, audit logs, global
search, notifications.
