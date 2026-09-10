# AI Chatbot SaaS — Project Overview

> Multi-tenant platform for building AI chatbots, embedding them on customer websites,
> and turning the resulting conversations into a managed sales pipeline.
>
> **Status:** Working prototype, feature-complete across all major flows.
> Not production-ready — see [Current State](#current-state--audit) for the blockers.
> **Audited:** 2026-09-10 · **Branch:** `main` @ `9f8d876`

---

## What this project is

A **B2B SaaS** where a business owner signs up, configures an AI chatbot for their
website, pastes one `<script>` tag into their site, and gets a working support/sales
assistant that answers from their own documents and captures leads.

The distinguishing feature is that it doesn't stop at the chat. Conversations that
produce a lead flow into a **built-in CRM pipeline** — stages, priorities, deal values,
tasks, and an activity log. Most chatbot products hand you a transcript and a webhook.
This one keeps the lead and helps you work it.

It's built for the **Philippine market**: prices are in PHP (₱), and billing runs on
**manual bank transfer with admin approval** rather than a card processor. Stripe is
scaffolded in the schema but deliberately unused.

### Who uses it

| Role | What they do |
|---|---|
| **Website visitor** | Chats with the widget on a customer's site. Never signs up. |
| **Customer** (`role = 'user'`) | Builds chatbots, uploads knowledge, works the enquiry pipeline, pays for a plan. |
| **Platform admin** (`role = 'admin'`) | Approves payments, holds the shared LLM API keys, manages users, sees platform analytics. |

The **platform-key model** is central: admins store one set of OpenAI/Anthropic/Google
keys in the database, and every customer chatbot uses them by default. Customers can
optionally supply their own key per chatbot. This means a customer can go from signup
to working chatbot without ever obtaining an API key.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.2.1** (App Router, React 19.2.4, Server Components) |
| Language | TypeScript 5, strict |
| Database | **Supabase Postgres 17** + `pgvector` |
| Auth | Supabase Auth (cookie sessions, SSR-aware) |
| AI | **Vercel AI SDK v6** — OpenAI, Anthropic, Google Gemini |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |
| Styling | Tailwind CSS v4 + shadcn/ui + Base UI |
| State | TanStack Query (server), Zustand (client) |
| Rate limiting | Upstash Redis, sliding window |
| Testing | Vitest + Testing Library + MSW |
| Hosting | Vercel + GitHub Actions |

> **Note on Next.js 16:** `middleware.ts` is now **`src/proxy.ts`**, exporting a
> `proxy()` function. Per `AGENTS.md`, check `node_modules/next/dist/docs/` before
> writing framework code — this version diverges from older conventions.

### Scale

| | |
|---|---|
| TypeScript / TSX | ~21,000 lines |
| API routes | 39 |
| Pages | 19 |
| React components | 45 |
| Data hooks | 11 |
| DB migrations | 11 |
| Test files | 25 (226 tests) |

---

## Core features

### 1. Chatbot builder

Each chatbot carries its own identity and behaviour:

- **Personality prompt** — free-text system prompt
- **Skills** — six presets injected into the prompt: Answer FAQs, Book Appointment,
  Product Recommendations, Technical Support, Order Tracking, General Enquiry
- **Model selection** — provider + model, from the admin-curated catalogue
- **Welcome message** and **quick action** buttons
- **Branding** — primary colour, widget position (bottom-left / bottom-right)
- **Domain lock** — the chat API rejects requests whose `Origin` doesn't match

### 2. Knowledge base (RAG)

Upload PDF, DOCX, or TXT → text extracted (`pdf-parse`, `mammoth`) → chunked at
~500 chars with 50-char overlap on sentence boundaries → embedded → stored as
`vector(1536)` in `document_chunks`.

At chat time, `match_chunks()` — a Postgres function — does cosine similarity search
filtered by chatbot, returning the top 5 above a 0.3 threshold. The whole search
happens **inside Postgres in one round trip**.

### 3. Embeddable widget

`GET /api/widget/[chatbotId]` returns ~1,000 lines of **self-contained vanilla JS**.
No React, no build step, no dependencies on the host page. It injects its own scoped
styles, renders the launcher and chat window, streams responses, and renders rich
cards. Customers embed it with one script tag.

### 4. Chat pipeline

`POST /api/chat/[chatbotId]` is the hot path:

```
rate limit → load chatbot → validate origin → load owner profile
  → check suspension → check billing expiry → enforce message quota
  → load history → RAG search → assemble tools → stream from LLM
  → persist messages → increment usage
```

Streaming uses the AI SDK. Every message is persisted to `messages` and counted
against the owner's plan quota.

### 5. Agentic tools

The chatbot doesn't just talk — it can act. Three tool families are generated
dynamically per chatbot and handed to the model:

- **Enquiry forms** — admin-defined field sets become a callable tool with a
  generated Zod schema. The model collects fields conversationally, then submits.
- **Custom tools** — name, description, parameters, optional webhook. Fires a POST
  to the customer's endpoint.
- **API connections** — full outbound HTTP: method, URL templating (`{param}`),
  custom headers, request-body templates. Responses can render as **rich cards**
  in the widget with a CTA that either links out or opens an enquiry form.

### 6. Enquiry pipeline (CRM)

Captured leads land in a real pipeline, not an inbox:

- **Stages** with a defined funnel path and terminal states (`won` / `lost`)
- **Priority** levels, **deal value**, **tags**, **lost reason**
- **Next action** timestamps with overdue detection
- **Tasks** — title, due date, completion tracking
- **Activity log** — typed, chronological audit trail
- **CSV export**

### 7. Conversations inbox

Customers browse every conversation their bots have had, read full threads, and set
status. Visitor identity is tracked by `visitor_id` and IP.

### 8. Billing — manual bank transfer

| Plan | Messages/mo | Chatbots | Monthly | Yearly |
|---|---|---|---|---|
| Free | 500 | 1 | ₱0 | — |
| Pro | 5,000 | 5 | ₱500 | ₱5,000 |
| Enterprise | 50,000 | 20 | ₱2,000 | ₱20,000 |

Yearly is "pay for 10 months, get 12."

**Flow:** customer views admin-configured bank details → transfers → uploads proof
(image/PDF, validated by MIME and size) into a private `payment-proofs` bucket →
admin reviews and approves or rejects → plan and quota apply on approval.

A **daily Vercel cron** (`0 0 * * *` → `/api/cron/check-billing`) expires lapsed
periods. Expiry is also re-checked inline on every chat request, so a lapsed account
downgrades to Free immediately rather than waiting for the cron.

### 9. Admin console

Platform stats · analytics (revenue, plan mix, message volume, top chatbots) ·
payment approvals · user management · **user impersonation** (with a persistent
banner) · LLM provider and model catalogue with per-model token costs ·
platform settings (rate limits, upload caps, plan config, bank details).

---

## Data model

16 tables in `public`, all under row-level security.

```
profiles ──┬── chatbots ──┬── conversations ── messages
           │              ├── knowledge_documents ── document_chunks (vector)
           │              ├── chatbot_tools
           │              ├── chatbot_api_connections
           │              ├── enquiry_forms
           │              └── enquiries ──┬── enquiry_tasks
           │                              └── enquiry_activities
           └── payments

llm_providers ── llm_provider_models        platform_settings
```

`profiles` extends `auth.users` and holds role, plan, `message_count` /
`message_limit`, billing cycle and period start, and `is_active` for suspension.

---

## Security model

Defence is layered, and **RLS is the foundation** — not an afterthought:

1. **`src/proxy.ts`** — route guards. Redirects unauthenticated users, checks
   `role = 'admin'` for `/admin/*`, and explicitly allowlists the three public
   endpoints (`/api/chat/`, `/api/widget/`, `/api/enquiries/submit`).
2. **RLS policies** — every table. Tenant isolation is enforced in the database, so
   a missing `WHERE` clause in app code doesn't leak another customer's rows.
3. **Three scoped clients** — browser (`client.ts`), server-with-cookies
   (`server.ts`), and service-role (`admin.ts`, bypasses RLS — used only where a
   public visitor legitimately needs to write).
4. **Domain validation** — chat requests are rejected if `Origin` doesn't match.
5. **Rate limiting** — 20 requests/minute sliding window, degrading gracefully when
   Upstash isn't configured.
6. **Quota enforcement** — checked before the LLM call, not after.

---

## CI/CD

`.github/workflows/deploy.yml`, three gated jobs on push to `main`:

1. **verify** — lint, typecheck, unit tests
2. **migrate** — applies `supabase/migrations/*.sql` to production via the pinned
   Supabase CLI (v2.117.0), behind a GitHub environment approval gate
3. **deploy** — builds and ships to Vercel

Migrations run **before** the new code goes live, so the deployed app never queries a
schema that doesn't exist yet. The workflow validates its secrets up front and fails
in seconds with a readable message rather than an opaque auth error mid-run.

---

## Current state — audit

### Working

All nine feature areas above are implemented end to end. Production source
**typechecks clean** — there is not a single type error in non-test code. The local
Supabase stack runs, all 11 migrations apply, and seed data loads.

### 🔴 Blockers — CI is red on all three gates

Verified by running each gate directly:

| Gate | Exit | Problem |
|---|---|---|
| `npm test` | **1** | 3 failures, all in `src/lib/rag.test.ts` |
| `npx tsc --noEmit` | **1** | 12 errors, all in `.test.ts` files |
| `npx eslint` | **1** | 5 errors, 8 warnings |

**Nothing can deploy until these are fixed** — the `verify` job blocks `migrate`,
which blocks `deploy`.

1. **`src/lib/rag.test.ts` is stale.** `src/lib/openai.ts` was refactored to export an
   async `getOpenAIClient()` that pulls the platform key from the database, but the
   test still mocks a bare `openai` export. All three failures trace to this one
   mismatch. *Test-only — the RAG code itself is correct.*

2. **12 typecheck errors**, all `possibly 'undefined'` on `tool.execute` in
   `src/lib/ai/tools.test.ts` and `documents/route.test.ts`. Needs non-null assertions
   or guards.

3. **5 lint errors** — `react/display-name` in three hook tests, plus an unused
   `context` parameter at `src/lib/ai/tools.ts:207`.

### 🟡 Performance

**Document ingest is serial** — `src/app/api/chatbots/[id]/documents/route.ts:76-85`
loops one chunk at a time, awaiting an OpenAI call *and* a database insert on each
pass. A 100-chunk document is 200 sequential round trips. OpenAI's embeddings endpoint
accepts an array; batching the embeds and doing a single bulk insert turns minutes
into seconds. **Highest-value fix in the codebase.**

**Two avoidable round trips in the chat hot path** — `route.ts:39` loads the chatbot,
then `route.ts:67` loads the owner profile via `chatbot.user_id`. One embedded select
does both. (Measured: ~3 ms per API round trip locally, versus 0.05 ms for the SQL
itself.)

*Counter-example done right:* `/api/admin/stats` already parallelises six count
queries with `Promise.all`. That's the pattern to copy.

### 🟡 Configuration

- `.env.local` holds placeholder values for `OPENAI_API_KEY` and both Upstash
  variables. Embeddings and rate limiting are inert locally until real keys are set —
  though the OpenAI key can instead be configured at `/admin/providers`, which is the
  intended path.
- **`.env.production` contains a live service-role key** (`.env.production:9`). It is
  correctly gitignored, but that key bypasses every RLS policy in production. Keep it
  out of anything that syncs, and rotate it if it has ever been shared.

### Not built (by design)

- **Stripe** — `stripe_customer_id` exists on `profiles` and env vars are commented
  out in `.env.example`. Manual bank transfer is the deliberate current model.
- **Multi-statement transactions** — PostgREST can't do them. If an operation ever
  needs true atomicity, write a Postgres function and call it via `.rpc()`, the way
  `match_chunks` already works.

---

## Getting started

```bash
npm install
npm run db:start      # Supabase local stack (Docker)
npm run db:reset      # apply migrations + seed
npm run dev           # http://localhost:3000
```

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Supabase API | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | http://127.0.0.1:54323 |

Set the OpenAI platform key at `/admin/providers` after signing in as an admin —
that's the intended path, and it makes embeddings work without touching `.env.local`.

### Related docs

`GETTING_STARTED.md` · `WIDGET_ARCHITECTURE.md` · `WIDGET_RENDERING.md` ·
`LLM_USAGE_EXPLAINED.md` · `PRODUCT_ANALYSIS.md` · `ai-chatbot-saas-plan.md` ·
`ai-chatbot-saas-checklist.md`
