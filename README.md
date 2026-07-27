# RestaurantOS — AI-Powered Restaurant Management Platform

A full-stack restaurant management platform built for a technical assessment, centered on
an **AI Invoice Processing** module: upload printed or handwritten supplier invoices,
have Google Gemini extract structured line items, review/correct them, and get an
auto-generated Expense Register. Beyond that, it covers RBAC auth, the full set of
restaurant/inventory/expense CRUD modules, a real-data dashboard, five distinct AI
features, real-time order updates, an audit trail, dark mode, tests, and CI.

## Live demo

- App: https://restaurantos-sage.vercel.app
- Demo accounts (password `password123` for all):
  - `owner@restaurantos.dev` — Owner (full access)
  - `manager@restaurantos.dev` — Manager (full access)
  - `chef@restaurantos.dev` — Chef (menu/ingredients)
  - `waiter@restaurantos.dev` — Waiter (tables/orders)
  - `cashier@restaurantos.dev` — Cashier (orders/expenses)

## Tech stack & why

| Concern | Choice | Why |
|---|---|---|
| Frontend + backend | **Next.js 16 (App Router)**, TypeScript | One deployable app instead of three separate services — faster to build correctly and reason about, still cleanly layered (UI in `app/`, data access in `lib/`, API in `app/api/`). |
| Database | **PostgreSQL** via **Prisma** | Required by the brief. Prisma gives type-safe queries and versioned migrations (`prisma/migrations`). |
| Hosted Postgres | **Neon** (serverless Postgres) | Free, instant provisioning, same connection string works locally and in production. |
| AI / OCR | **Google Gemini 2.5 Flash** (multimodal vision, structured JSON output) | Reads both printed and handwritten invoices from a single image/PDF input, and Gemini's `responseSchema` forces valid structured JSON back — no brittle regex/text parsing. Verified against the assessment's sample invoices: near-perfect field and line-item extraction on both a printed multi-line invoice and a genuinely handwritten one. |
| File storage | **Vercel Blob** (falls back to local `/public/uploads` if no token is set) | Vercel's serverless filesystem is ephemeral, so uploaded invoice files need object storage in production. |
| Auth | Custom **JWT (httpOnly cookie) + bcrypt**, via `jose` (Edge-safe) | Full control, no framework magic, works identically in Node route handlers and the Edge-compatible `proxy.ts` route guard. |
| Real-time | **Pusher Channels** (hosted WebSocket service) | Vercel's serverless functions can't hold a raw WebSocket connection open; Pusher gives the client a real WebSocket while API routes just publish to it over HTTP. |
| Spreadsheet export | **exceljs** | Generates the required Expense Register `.xlsx`. |
| CSV import | Hand-rolled RFC 4180 parser (`lib/csv.ts`) | The import format is a flat 4-column CSV, so a ~40-line parser (handles quoted fields/commas) avoids a dependency for something this small. |
| Containerization | **Docker + Docker Compose** | `docker compose up` runs Postgres and the app together with zero local Node/Postgres install, for graders who'd rather not set up a Neon project. |
| Charts | **Recharts** | Dashboard visualizations. |
| Tests | **Vitest** | Fast, TypeScript-native, zero-config with path aliases. |
| CI | **GitHub Actions** | Typecheck, lint, test, build on every push/PR. |

### A deliberate simplification worth explaining

The assessment brief allows **Node.js *or* FastAPI** for the backend, with FastAPI called
out specifically "for AI features." AI extraction is implemented as a Next.js server route
(`app/api/invoices/upload/route.ts`) calling Gemini directly, rather than standing up a
separate FastAPI microservice. This keeps the system to one deployable unit with one
request path to explain and debug, at the cost of not literally using Python/FastAPI —
a conscious tradeoff to protect the quality of the AI Invoice Processing module itself
(the one graded against real sample data) rather than splitting effort across a second
service that adds deployment risk without changing what the module actually does.

## Architecture

```
app/
  (dashboard)/         Authenticated pages (sidebar + topbar layout), one folder per module
    dashboard/          Business insights + charts
    invoices/            List, detail, and the upload/review flow (the AI centerpiece)
    expenses/             Expense records (monthly tracking) + categories sub-page
    audit-log/             Activity/audit trail viewer (Owner/Manager only)
    suppliers/, menu/, ingredients/, tables/, orders/, staff/, purchase-orders/
  api/                  Route handlers — one folder per resource, REST-ish (GET/POST/PATCH/DELETE)
  login/                 Public login page
lib/
  auth.ts               Password hashing, JWT sign/verify, getSession()
  permissions.ts          Single source of truth for RBAC (route prefix -> allowed roles)
  prisma.ts                Prisma client singleton
  gemini.ts                 Gemini client + all 5 AI features (invoice extraction, menu pricing,
                              shortage/reorder prediction, prep-time estimate, waste analysis)
  storage.ts                Uploaded-file storage (Vercel Blob in prod, local disk in dev)
  realtime.ts                 Pusher publish helper (server side)
  useOrdersRealtime.ts          Pusher subscribe hook (client side)
  audit.ts                       Fire-and-forget activity logger
  monthRange.ts                   Pure month-boundary helper, shared + unit tested
components/
  CrudTable.tsx          One reusable list+create+delete component powering every simple CRUD
                          module (Suppliers, Expense Categories, Ingredients, Tables, Staff).
                          Menu and Invoices get custom UIs because they need AI-specific behavior.
  Sidebar.tsx, Topbar.tsx, ApproveButton.tsx, ThemeToggle.tsx
prisma/
  schema.prisma           Full data model
  seed.ts                    Demo users, categories, suppliers, ingredients, a couple of menu items
lib/__tests__/            Vitest unit tests (permissions, month-range math, food-cost calc)
.github/workflows/ci.yml  Typecheck + lint + test + build on push/PR
proxy.ts                (Next.js 16's renamed `middleware.ts`) — RBAC route guard, runs before every
                          protected page: no session -> redirect to /login; wrong role -> redirect to /dashboard
```

**Why one reusable `CrudTable` component**: five of the required modules (Suppliers,
Expense Categories, Ingredients, Tables, Staff) are structurally identical — a list, an
add form, delete. Building one generic component and configuring it per-module (see
`app/(dashboard)/suppliers/page.tsx` for the shortest example) means there is exactly one
CRUD pattern to understand in this codebase, not five slightly different ones. Menu
Management and the Invoices module intentionally break from this pattern because they
have real custom behavior (recipe editing, AI price/prep-time; the upload → AI extraction
→ review → confirm flow).

## Data model

See `prisma/schema.prisma`. Highlights:

- `Invoice` + `InvoiceLineItem` — one row per uploaded invoice and its line items, with
  `rawExtractionJson` keeping the full AI response for audit/debugging, `isHandwritten`
  and `ocrConfidence` self-reported by the model, and `vendorNameRaw` preserving the
  AI-read vendor name even when it isn't matched to an existing `Supplier`.
- `ExpenseRecord` — the expense register: one row per expense, whether it came from an
  AI-processed invoice (`invoiceId` set) or manual entry (`invoiceId` null).
- `RecipeIngredient` — join table between `MenuItem` and `Ingredient` with a quantity,
  editable from the Menu page; feeds the pricing, prep-time, and shortage-prediction AI
  features.
- `WasteLog` — logged ingredient waste (quantity, reason, date), feeds the waste-analysis
  AI feature.
- `AuditLog` — one row per notable mutation across the app (who did what, when).

## AI Invoice Processing — how it works

1. **Upload** (`/invoices/upload`) — one or more image/PDF files.
2. **Extract** (`POST /api/invoices/upload`) — each file is sent to Gemini
   (`gemini-2.5-flash`) with a JSON schema (`lib/gemini.ts`) covering vendor, invoice
   number/date, currency, line items, subtotal/tax/total, an `isHandwritten` flag, and a
   self-reported `confidence`. Gemini's structured-output mode guarantees valid JSON back.
   Nothing is persisted yet at this point.
3. **Review** — the extracted draft is fully editable in the UI (every field, every line
   item) before saving, which matters most for handwritten invoices where the model may
   misread a digit.
4. **Confirm** (`POST /api/invoices`) — persists the `Invoice`, its `InvoiceLineItem`s,
   and an `ExpenseRecord` in one call (Prisma nested writes), and writes an audit log entry.
5. **Expense Register export** (`GET /api/expense-register/export`, also reachable from
   the Expenses page with an optional `?month=YYYY-MM` filter) — streams an `.xlsx` built
   with `exceljs`: date, category, supplier, invoice #, description, amount, source
   (AI Invoice vs Manual), recorded by, with a total row.

## All 5 AI features

1. **Invoice extraction** (above) — printed and handwritten supplier invoices.
2. **Suggest menu pricing** (Menu page) — given a menu item's linked recipe ingredients
   and their costs, computes food cost and asks Gemini for a suggested price + margin
   rationale, targeting the standard 28–35% food-cost ratio.
3. **Predict ingredient shortages + recommend reorder quantities** (Ingredients page,
   "Run analysis") — for every ingredient, combines current stock/reorder threshold with
   *real* 7-day usage (derived from `OrderItem`s expanded through each menu item's recipe,
   not a made-up number) and asks Gemini to classify urgency and recommend a reorder
   quantity.
4. **Estimate food preparation time** (Menu page, per item) — estimates kitchen prep/cook
   time in minutes from a menu item's recipe and complexity.
5. **Analyze ingredient waste** (Ingredients page) — log wastage (ingredient, quantity,
   reason), then ask Gemini to identify the top cost offenders and give concrete reduction
   recommendations grounded in the logged reasons.

All five share the same pattern in `lib/gemini.ts`: a Gemini `responseSchema` forcing
structured JSON output, so route handlers never hand-parse free-text model output.

## Real-time order updates (WebSocket)

`lib/realtime.ts` publishes to **Pusher Channels** whenever an order is created or its
status changes; the Orders page subscribes directly over a real WebSocket via `pusher-js`
(`lib/useOrdersRealtime.ts`) and refetches, so a kitchen display and a waiter's phone stay
in sync without polling. Shows a "● Live" badge when configured. The app runs fine without
Pusher env vars set — publishing/subscribing just no-ops.

## Activity / audit log

`lib/audit.ts` is a small fire-and-forget logger wired into the mutations worth a trail:
invoice created/approved, supplier created/updated/deleted, menu item created, recipe
ingredient linked/removed, order created/status changed, ingredient waste logged. Viewable
at **Activity Log** in the sidebar (Owner/Manager only, enforced by the same
`lib/permissions.ts` map that drives route guarding and nav visibility).

## Dark mode

An explicit toggle (sun/moon button in the topbar), not the OS `prefers-color-scheme` —
that distinction matters here: an OS-driven dark mode is what originally made the login
inputs unreadable during development (white input text auto-inherited on a still-white
input background). Dark mode is now opt-in via a `.dark` class set by
`components/ThemeToggle.tsx`, applied pre-paint by a small script in `app/layout.tsx` to
avoid a flash of the wrong theme, and persisted in `localStorage`.

## What's implemented

Everything in the assessment brief's module list, plus all 5 listed AI features, plus most
of the bonus list:

- **Full**: Auth + RBAC (5 roles), AI Invoice Processing end-to-end, Expense Records +
  Monthly Tracking, Dashboard (7 real, non-mocked widgets/charts), Suppliers, Expense
  Categories, Menu + Recipe Management + AI pricing + AI prep-time, Ingredients + AI
  shortage/reorder + AI waste analysis, Tables, Orders (with real-time status updates),
  Staff, Purchase Orders, Activity/Audit Log, Dark Mode, Unit Tests, CI/CD, WebSockets.
- **Full**: Order Management now models per-item kitchen routing (each `OrderItem` moves
  PENDING → IN_KITCHEN → READY → SERVED independently, driving the order's own status
  automatically) and bill splitting (record several `Payment`s against one order — split
  evenly N ways or by arbitrary amount/method — the order flips to PAID once they cover the
  total). Docker/Docker Compose (see below). CSV import for the expense register,
  symmetric with the existing Excel export.

## Setup — run locally

### Prerequisites

- Node.js 20.9+
- A PostgreSQL database (e.g. a free [Neon](https://neon.tech) project)
- A Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### Steps

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npx prisma migrate dev # creates tables
npm run db:seed        # demo users, suppliers, categories, ingredients, menu items
npm run dev
```

Open `http://localhost:3000`, log in with any demo account above.

`BLOB_READ_WRITE_TOKEN` and the `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` vars can be left empty
locally — uploaded invoice files fall back to `/public/uploads/invoices`, and real-time
order updates just no-op. Set them for production (Vercel Blob store; a free
[Pusher Channels](https://pusher.com) app).

### Trying the AI Invoice Processing module

Sample invoices used to build/test this module (both printed and a genuinely handwritten
one) are in the assessment's `invoices.zip`. Go to **Invoices → Upload Invoice**, select
one or more files, and watch the extraction populate a review form you can correct before
saving.

### Running tests

```bash
npm test
```

## Running with Docker

Zero local Node/Postgres setup needed — this spins up Postgres and the app together, runs
migrations on boot, then serves on `http://localhost:3000`:

```bash
docker compose up --build
docker compose exec app npm run db:seed   # first run only — demo users, sample data
```

`GEMINI_API_KEY`, `JWT_SECRET`, and the optional `BLOB_READ_WRITE_TOKEN` / `PUSHER_*` vars
are read from your shell environment (or a `.env` file next to `docker-compose.yml` — Compose
loads it automatically) and passed through to the `app` container; Postgres credentials are
fixed in `docker-compose.yml` and wired into `DATABASE_URL` automatically. The image builds
via Next.js's `output: "standalone"` mode and runs `prisma migrate deploy` before starting.

## Deployment

- **Vercel** hosts the Next.js app.
- **Neon** hosts Postgres (same `DATABASE_URL` as local dev).
- **Vercel Blob** stores uploaded invoice files in production.
- **Pusher Channels** powers real-time order updates.

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add GEMINI_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add PUSHER_APP_ID production
vercel env add PUSHER_KEY production
vercel env add PUSHER_SECRET production
vercel env add PUSHER_CLUSTER production
vercel env add NEXT_PUBLIC_PUSHER_KEY production
vercel env add NEXT_PUBLIC_PUSHER_CLUSTER production
vercel --prod
```

## API overview

All routes under `/api/*` require an authenticated session (httpOnly cookie set by
`/api/auth/login`) except `/api/auth/login` itself. Every resource follows the same
shape: `GET` (list), `POST` (create), `PATCH /:id` (update), `DELETE /:id` (remove) —
see `app/api/*/route.ts` and `app/api/*/[id]/route.ts`.

Notable non-CRUD endpoints:

- `POST /api/invoices/upload` — AI extraction (draft, not persisted)
- `POST /api/invoices` — persist a reviewed invoice draft
- `GET /api/expense-register/export?month=YYYY-MM` — Excel export
- `POST /api/menu-items/:id/suggest-price` — AI menu pricing
- `POST /api/menu-items/:id/estimate-prep-time` — AI prep-time estimate
- `POST /api/ingredients/analyze-shortages` — AI shortage prediction + reorder quantities
- `POST /api/waste-logs/analyze` — AI waste analysis
- `POST /api/recipe-ingredients`, `DELETE /api/recipe-ingredients/:id` — recipe editing
- `GET /api/dashboard` — aggregated dashboard stats
- `GET /api/audit-log` — activity trail
