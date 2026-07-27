# RestaurantOS — AI-Powered Restaurant Management Platform

A full-stack restaurant management platform built for a technical assessment, centered on
an **AI Invoice Processing** module: upload printed or handwritten supplier invoices,
have Google Gemini extract structured line items, review/correct them, and get an
auto-generated Expense Register.

## Live demo

- App: `<filled in after deploy>`
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
| AI / OCR | **Google Gemini** (multimodal vision, structured JSON output) | Reads both printed and handwritten invoices from a single image/PDF input, and Gemini's `responseSchema` forces valid structured JSON back — no brittle regex/text parsing. |
| File storage | **Vercel Blob** (falls back to local `/public/uploads` if no token is set) | Vercel's serverless filesystem is ephemeral, so uploaded invoice files need object storage in production. |
| Auth | Custom **JWT (httpOnly cookie) + bcrypt**, via `jose` (Edge-safe) | Full control, no framework magic, works identically in Node route handlers and the Edge-compatible `proxy.ts` route guard. |
| Spreadsheet export | **exceljs** | Generates the required Expense Register `.xlsx`. |
| Charts | **Recharts** | Dashboard visualizations. |

### A deliberate simplification worth explaining

The assessment brief allows **Node.js *or* FastAPI** for the backend, with FastAPI called
out specifically "for AI features." Given the time box for this build, AI extraction is
implemented as a Next.js server route (`app/api/invoices/upload/route.ts`) calling Gemini
directly, rather than standing up a separate FastAPI microservice. This keeps the system
to one deployable unit with one request path to explain and debug, at the cost of not
literally using Python/FastAPI. The tradeoff was made consciously to protect the quality
of the AI Invoice Processing module itself (the one graded against real sample data)
rather than splitting effort across a second service.

## Architecture

```
app/
  (dashboard)/         Authenticated pages (sidebar + topbar layout), one folder per module
    dashboard/          Business insights + charts
    invoices/            List, detail, and the upload/review flow (the AI centerpiece)
    expenses/             Expense records (monthly tracking) + categories sub-page
    suppliers/, menu/, ingredients/, tables/, orders/, staff/, purchase-orders/
  api/                  Route handlers — one folder per resource, REST-ish (GET/POST/PATCH/DELETE)
  login/                 Public login page
lib/
  auth.ts               Password hashing, JWT sign/verify, getSession()
  permissions.ts          Single source of truth for RBAC (route prefix -> allowed roles)
  prisma.ts                Prisma client singleton
  gemini.ts                 Gemini client + invoice-extraction schema/prompt + menu-pricing AI feature
  storage.ts                 Uploaded-file storage (Vercel Blob in prod, local disk in dev)
components/
  CrudTable.tsx          One reusable list+create+delete component powering every simple CRUD
                          module (Suppliers, Expense Categories, Ingredients, Tables, Staff).
                          Menu and Invoices get custom UIs because they need AI-specific behavior.
  Sidebar.tsx, Topbar.tsx, ApproveButton.tsx
prisma/
  schema.prisma           Full data model
  seed.ts                    Demo users, categories, suppliers, ingredients, a couple of menu items
proxy.ts                (Next.js 16's renamed `middleware.ts`) — RBAC route guard, runs before every
                          protected page: no session -> redirect to /login; wrong role -> redirect to /dashboard
```

**Why one reusable `CrudTable` component**: five of the required modules (Suppliers,
Expense Categories, Ingredients, Tables, Staff) are structurally identical — a list, an
add form, delete. Building one generic component and configuring it per-module (see
`app/(dashboard)/suppliers/page.tsx` for the shortest example) means there is exactly one
CRUD pattern to understand in this codebase, not five slightly different ones. Menu
Management and the Invoices module intentionally break from this pattern because they
have real custom behavior (AI price suggestions; the upload → AI extraction → review →
confirm flow).

## Data model

See `prisma/schema.prisma`. Highlights:

- `Invoice` + `InvoiceLineItem` — one row per uploaded invoice and its line items, with
  `rawExtractionJson` keeping the full AI response for audit/debugging, `isHandwritten`
  and `ocrConfidence` self-reported by the model, and `vendorNameRaw` preserving the
  AI-read vendor name even when it isn't matched to an existing `Supplier`.
- `ExpenseRecord` — the expense register: one row per expense, whether it came from an
  AI-processed invoice (`invoiceId` set) or manual entry (`invoiceId` null).
- `RecipeIngredient` — join table between `MenuItem` and `Ingredient` with a quantity;
  this is what the "Suggest AI price" feature reads to compute food cost.

## AI Invoice Processing — how it works

1. **Upload** (`/invoices/upload`) — one or more image/PDF files.
2. **Extract** (`POST /api/invoices/upload`) — each file is sent to Gemini
   (`gemini-2.0-flash`) with a JSON schema (`lib/gemini.ts`) covering vendor, invoice
   number/date, currency, line items, subtotal/tax/total, an `isHandwritten` flag, and a
   self-reported `confidence`. Gemini's structured-output mode guarantees valid JSON back.
   Nothing is persisted yet at this point.
3. **Review** — the extracted draft is fully editable in the UI (every field, every line
   item) before saving, which matters most for handwritten invoices where the model may
   misread a digit.
4. **Confirm** (`POST /api/invoices`) — persists the `Invoice`, its `InvoiceLineItem`s,
   and an `ExpenseRecord` in one call (Prisma nested writes).
5. **Expense Register export** (`GET /api/expense-register/export`, also reachable from
   the Expenses page with an optional `?month=YYYY-MM` filter) — streams an `.xlsx` built
   with `exceljs`: date, category, supplier, invoice #, description, amount, source
   (AI Invoice vs Manual), recorded by, with a total row.

## AI features beyond invoice processing

- **Suggest menu pricing** (`Menu` page, "✨ Suggest AI price" button) — given a menu
  item's linked `RecipeIngredient`s and their costs, computes food cost and asks Gemini
  for a suggested price + margin rationale, targeting the standard 28–35% food-cost ratio.

## What's implemented vs. simplified (honesty over checkbox completeness)

The brief explicitly values architecture and code quality over feature-count, so under a
tight time box the following calls were made:

- **Implemented in full**: Auth + RBAC (5 roles), AI Invoice Processing end-to-end
  (upload → extract → review → persist → export), Expense Records + Monthly Tracking,
  Dashboard (active orders, table occupancy, low stock, monthly expenses, purchase
  summary, supplier summary, expense-by-category and 6-month trend charts), Suppliers,
  Expense Categories, Menu + AI pricing, Ingredients, Tables, Orders (create against a
  table, advance status OPEN → IN_KITCHEN → SERVED → PAID), Staff, Purchase Orders.
- **Simplified**: Recipe Management exists as data (`RecipeIngredient`) and is seeded/used
  by the AI pricing feature, but has no dedicated recipe-builder UI — ingredients are
  currently linked via the seed script, not a form. Order Management doesn't model
  per-item kitchen routing or splitting a bill.
- **Not implemented**: the four remaining "AI Features" beyond invoice processing and menu
  pricing (shortage prediction, reorder quantity recommendation, prep-time estimation,
  waste analysis), WebSockets, activity/audit log, dark mode, CI/CD config, unit tests.
  All of these are straightforward extensions of the existing `lib/gemini.ts` /
  `lib/prisma.ts` patterns — cut for time, not difficulty.

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

`BLOB_READ_WRITE_TOKEN` can be left empty locally — uploaded invoice files fall back to
`/public/uploads/invoices`. Set it (from a Vercel Blob store) for production, where the
filesystem is not writable/persistent.

### Trying the AI Invoice Processing module

Sample invoices used to build/test this module (both printed and a genuinely handwritten
one) are in the assessment's `invoices.zip`. Go to **Invoices → Upload Invoice**, select
one or more files, and watch the extraction populate a review form you can correct before
saving.

## Deployment

- **Vercel** hosts the Next.js app.
- **Neon** hosts Postgres (same `DATABASE_URL` as local dev).
- **Vercel Blob** stores uploaded invoice files in production.

```bash
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add GEMINI_API_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
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
- `GET /api/dashboard` — aggregated dashboard stats
