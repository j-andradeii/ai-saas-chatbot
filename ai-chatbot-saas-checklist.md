# AI Chatbot SaaS — Implementation Checklist

> Derived from: [[ai-chatbot-saas-plan]]
> Each task is broken down to a single, atomic action — no ambiguity, no guessing.
> Every phase ends with **Unit Testing** and **Acceptance Criteria** gates.

---

## Phase 0 — Project Bootstrap & Environment Setup

### 0.1 Create Next.js Project
- [x] Run `npx create-next-app@latest ai-chatbot-saas --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [x] Verify project runs: `npm run dev` → loads at `http://localhost:3000`
- [x] Delete boilerplate content from `src/app/page.tsx` (replace with `<h1>AI Chatbot SaaS</h1>`)
- [x] Delete `src/app/globals.css` boilerplate styles (keep only Tailwind directives: `@tailwind base; @tailwind components; @tailwind utilities;`)

### 0.2 Install Core Dependencies
- [x] Install Supabase: `npm install @supabase/supabase-js @supabase/ssr`
- [x] Install AI SDK: `npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google`
- [x] Install OpenAI (embeddings only): `npm install openai`
- [x] Install UI: `npx shadcn@latest init` → select defaults (New York theme, slate colors, CSS variables YES)
- [x] Install shadcn components: `npx shadcn@latest add button input label card table dialog select textarea badge tabs toast dropdown-menu separator sheet avatar`
- [x] Install Forms: `npm install react-hook-form @hookform/resolvers zod`
- [x] Install State: `npm install zustand @tanstack/react-query`
- [x] Install Rate Limiting: `npm install @upstash/ratelimit @upstash/redis`
- [x] Install Testing: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw`

### 0.3 Create Environment Variables
- [x] Create `.env.local` file in project root with:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  OPENAI_API_KEY=
  UPSTASH_REDIS_REST_URL=
  UPSTASH_REDIS_REST_TOKEN=
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- [x] Add `.env.local` to `.gitignore` (should already be there)
- [x] Create `.env.example` with placeholder values (no real keys) for team reference — include all 7 core vars + note about CI/CD secrets (Stripe vars commented out as Future Iteration)
- [x] Note for CI/CD (added to GitHub Secrets, NOT `.env.local`):
  - `SUPABASE_PROJECT_REF` — your Supabase project ref ID (from Supabase dashboard → Settings → General)
  - `SUPABASE_ACCESS_TOKEN` — personal access token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)

### 0.4 Create Supabase Project
- [x] Create project at [supabase.com](https://supabase.com) → note region (default `us-east-1`)
- [x] Copy `Project URL` → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
- [x] Copy `anon public` key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] Copy `service_role secret` key → paste as `SUPABASE_SERVICE_ROLE_KEY`
- [x] Enable pgvector extension: SQL Editor → run `create extension if not exists vector;`

### 0.5 Create Upstash Redis
- [x] Create Redis database at [upstash.com](https://upstash.com) → select same region as Supabase
- [x] Copy `UPSTASH_REDIS_REST_URL` → paste into `.env.local`
- [x] Copy `UPSTASH_REDIS_REST_TOKEN` → paste into `.env.local`

### 0.6 Configure Vitest
- [x] Create `vitest.config.ts` in project root:
  - Plugin: `@vitejs/plugin-react`
  - Environment: `jsdom`
  - Globals: `true`
  - Setup files: `['./src/test/setup.ts']`
  - Include: `['src/**/*.test.{ts,tsx}']`
  - Path alias: `@` → `./src`
  - Coverage provider: `v8`, thresholds: 80% statements, 75% branches, 80% functions, 80% lines
- [x] Create `src/test/setup.ts`:
  - Import `@testing-library/jest-dom/vitest`
  - Import `cleanup` from `@testing-library/react` → call in `afterEach`
  - Call `vi.restoreAllMocks()` in `afterEach`
  - Mock `next/headers` (cookies: getAll, set)
  - Mock `next/navigation` (redirect, useRouter, useSearchParams)
- [x] Create `src/__mocks__/supabase.ts`:
  - Export `createMockSupabaseClient()` factory that returns chainable mock (from, select, insert, update, delete, eq, single, etc.)
  - Expose `_mockQuery` for assertions
- [x] Add npm scripts to `package.json`:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"test:ui": "vitest --ui"`
  - `"test:coverage": "vitest run --coverage"`
- [x] Verify: `npm test` runs with 0 tests found (no errors)

### 0.7 Create TypeScript Types
- [x] Create `src/types/index.ts` with interfaces for:
  - `Profile` — id, full_name, email, company_name, role (`'admin' | 'user'`), plan (`'free' | 'pro' | 'enterprise'`), message_count, message_limit, billing_cycle (`'monthly' | 'yearly'`), billing_period_start, stripe_customer_id (Future Iteration), avatar_url, is_active, last_login_at, created_at
  - `Payment` — id, user_id, amount, currency, plan_requested (`'pro' | 'enterprise'`), billing_cycle (`'monthly' | 'yearly'`), proof_url, proof_file_name, reference_number, status (`'pending' | 'approved' | 'rejected'`), admin_notes, reviewed_by, reviewed_at, period_start, period_end, created_at
  - `LLMProvider` — id, name, display_name, models (array of `{id, name, input_cost_per_1m, output_cost_per_1m}`), platform_api_key, is_enabled, created_at, updated_at
  - `Chatbot` — id, user_id, name, domain, personality_prompt, welcome_message, skills (string[]), quick_actions (array of `{label, icon?, prompt}`), llm_provider, llm_model, api_key, primary_color, widget_position, active, created_at, updated_at
  - `ChatbotTool` — id, chatbot_id, name, description, parameters (Record<string, string>), webhook_url, is_enabled, created_at
  - `EnquiryForm` — id, chatbot_id, name, display_name, description, fields (array of `{name, label, type, required?, options?}`), webhook_url, success_message, is_enabled, created_at
  - `Enquiry` — id, enquiry_form_id, chatbot_id, conversation_id, form_name, data (Record<string, any>), visitor_id, visitor_ip, webhook_status (`'none' | 'pending' | 'sent' | 'failed'`), webhook_response_code, is_read, created_at
  - `KnowledgeDocument` — id, chatbot_id, file_name, file_url, file_size, mime_type, status (`'pending' | 'processing' | 'ready' | 'error'`), error_message, created_at
  - `Conversation` — id, chatbot_id, visitor_id, visitor_name, visitor_email, status (`'active' | 'resolved' | 'archived'`), created_at, updated_at
  - `Message` — id, conversation_id, role (`'user' | 'assistant' | 'tool'`), content, tool_name, tool_data, created_at

### 0.8 Create Lib Files (Stubs)
- [x] Create `src/lib/supabase/client.ts` — export `createClient()` using `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] Create `src/lib/supabase/server.ts` — export async `createClient()` using `createServerClient` from `@supabase/ssr` with cookie handlers (getAll, setAll)
- [x] Create `src/lib/supabase/admin.ts` — export `supabaseAdmin` using `createClient` from `@supabase/supabase-js` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- [x] Create `src/lib/openai.ts` — export `openai` instance using `new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })`
- [x] Create `src/lib/ratelimit.ts` — export `chatRatelimit` using `new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(20, '1 m'), analytics: true, prefix: 'ratelimit:chat' })`
- [x] Create `src/lib/utils.ts` — export `cn()` function (shadcn utility, likely already created by `shadcn init`)

#### Phase 0 — Unit Tests
- [x] `npm test` runs successfully with 0 tests, 0 failures
- [x] `npm run build` completes without TypeScript errors
- [x] All types in `src/types/index.ts` compile without errors

#### Phase 0 — Acceptance Criteria
- [x] `npm run dev` → app loads at `localhost:3000` with no console errors
- [x] `.env.local` has all 7 env vars populated with real values
- [ ] Supabase dashboard shows project is active with pgvector enabled
- [ ] Upstash dashboard shows Redis database is active
- [x] `vitest.config.ts` exists and `npm test` exits cleanly
- [x] All files from Section 0.8 exist and export their functions/constants

---

## Phase 1 — MVP: Auth, Chatbots, Chat API, Widget

### 1.1 Database Schema Migration
- [x] Create `supabase/migrations/001_initial_schema.sql`
- [x] Add `profiles` table — columns: id (uuid PK → auth.users), full_name, email, company_name, role (check: admin/user, default 'user'), plan (check: free/pro/enterprise, default 'free'), message_count (default 0), message_limit (default 100), billing_cycle (check: monthly/yearly, default 'monthly'), billing_period_start, stripe_customer_id (Future Iteration), avatar_url, is_active (default true), last_login_at, created_at
- [x] Add `llm_providers` table — columns: id (uuid PK), name, display_name, models (jsonb), platform_api_key, is_enabled (default false), created_at, updated_at
- [x] Add `chatbots` table — columns: id (uuid PK), user_id (FK → profiles), name, domain, personality_prompt, welcome_message, skills (text[]), quick_actions (jsonb), llm_provider (default 'openai'), llm_model (default 'gpt-4o'), api_key (unique, default gen_random_uuid()), primary_color, widget_position (check: bottom-right/bottom-left), active (default true), created_at, updated_at
- [x] Add `chatbot_tools` table — columns: id, chatbot_id (FK → chatbots, cascade), name, description, parameters (jsonb), webhook_url, is_enabled (default true), created_at
- [x] Add `enquiry_forms` table — columns: id, chatbot_id (FK → chatbots, cascade), name, display_name, description, fields (jsonb), webhook_url, success_message, is_enabled (default true), created_at
- [x] Add `enquiries` table — columns: id, enquiry_form_id (FK → enquiry_forms, set null), chatbot_id (FK → chatbots, cascade), conversation_id (FK → conversations, set null), form_name, data (jsonb), visitor_id, visitor_ip, webhook_status (check: none/pending/sent/failed), webhook_response_code, is_read (default false), created_at
- [x] Add `knowledge_documents` table — columns: id, chatbot_id (FK → chatbots, cascade), file_name, file_url, file_size, mime_type, status (check: pending/processing/ready/error), error_message, created_at
- [ ] Add `document_chunks` table — columns: id, document_id (FK → knowledge_documents, cascade), chatbot_id (FK → chatbots, cascade), content, embedding (vector(1536)), chunk_index, created_at *(deferred to Phase 2 — requires pgvector)*
- [x] Add `conversations` table — columns: id, chatbot_id (FK → chatbots, cascade), visitor_id, visitor_name, visitor_email, status (check: active/resolved/archived), created_at, updated_at
- [x] Add `messages` table — columns: id, conversation_id (FK → conversations, cascade), role (check: user/assistant/tool), content, tool_name, tool_data (jsonb), created_at
- [x] Add `payments` table — columns: id (uuid PK), user_id (FK → profiles, cascade), amount (decimal 10,2), currency (default 'USD'), plan_requested (check: pro/enterprise), billing_cycle (check: monthly/yearly), proof_url, proof_file_name, reference_number, status (check: pending/approved/rejected, default 'pending'), admin_notes, reviewed_by (FK → profiles), reviewed_at, period_start, period_end, created_at
- [x] Add all indexes as specified in plan Section 5 (**20 of 21 indexes** — vector index deferred to Phase 2):
  - `profiles(role)`, `profiles(plan)`
  - `chatbots(user_id)`, `chatbots(domain)`
  - `chatbot_tools(chatbot_id)`
  - `enquiry_forms(chatbot_id)`
  - `enquiries(chatbot_id)`, `enquiries(chatbot_id, created_at desc)`, `enquiries(enquiry_form_id)`, `enquiries(is_read)`
  - `knowledge_documents(chatbot_id)`
  - ~~`document_chunks(chatbot_id)`~~ *(deferred to Phase 2)*
  - ~~**`document_chunks` vector index**~~ *(deferred to Phase 2)*
  - `conversations(chatbot_id)`, `conversations(chatbot_id, created_at desc)`, `conversations(visitor_email)`
  - `messages(conversation_id)`, `messages(conversation_id, created_at)`
  - `payments(user_id)`, `payments(status)`, `payments(user_id, created_at desc)`
- [x] Add `update_updated_at()` trigger function
- [x] Add triggers: `chatbots_updated_at`, `conversations_updated_at`, `llm_providers_updated_at`
- [x] Add `handle_new_user()` trigger function (inserts into profiles on auth.users insert)
- [x] Add trigger `on_auth_user_created` on `auth.users`
- [x] Enable RLS on ALL 11 tables (profiles, llm_providers, chatbots, chatbot_tools, enquiry_forms, enquiries, knowledge_documents, conversations, messages, payments) *(document_chunks deferred to Phase 2)*
- [ ] Add `is_admin()` SQL function — returns boolean, checks `profiles.role = 'admin'` for `auth.uid()` *(MISSING — admin checks done inline in RLS policies instead)*
- [x] Add ALL RLS policies as specified in plan Section 5 (**22 policies** total):
  - profiles (4): users read own, users update own, admins read all, admins update all
  - llm_providers (2): all users read enabled, admins manage (all operations)
  - chatbots (2): users own theirs (all operations), admins read all
  - chatbot_tools (1): users own (via chatbot ownership, all operations)
  - enquiry_forms (1): users own (via chatbot ownership, all operations)
  - enquiries (3): users read theirs, users update theirs, admins read all
  - knowledge_documents (1): users own (via chatbot ownership, all operations)
  - ~~document_chunks (1)~~ *(deferred to Phase 2)*
  - conversations (2): users read theirs, admins read all
  - messages (2): users read theirs (via conversation→chatbot→user join), admins read all
  - payments (3): users read own, users create own, admins manage all
- [ ] Add `match_chunks()` SQL function for vector similarity search *(deferred to Phase 2 — requires pgvector + document_chunks table)*
- [ ] Add `increment_message_count()` SQL function *(MISSING — message count incremented via direct UPDATE in chat API instead)*
- [x] Add seed data: INSERT 3 LLM providers with models (via separate `llm_provider_models` table instead of jsonb):
  - openai: gpt-4o, gpt-4o-mini
  - anthropic: claude-sonnet-4-20250514, claude-haiku-4-20250414
  - google: gemini-2.0-flash, gemini-2.5-pro-preview-05-06
- [x] Run migration: applied locally via `supabase db reset`
- [x] Verify: all 11 tables created, RLS enabled, 22 policies, seed data present

### 1.2 Supabase Auth: Register & Login
- [x] Create `src/app/(auth)/login/page.tsx`:
  - Client component (`'use client'`)
  - Form with email + password inputs (React Hook Form + Zod validation: email required + valid email, password required + min 6 chars)
  - On submit: call `supabase.auth.signInWithPassword({ email, password })`
  - On success: `router.push('/dashboard')`
  - On error: display error message below form (e.g., "Invalid credentials")
  - Link to `/register` at bottom
- [x] Create `src/app/(auth)/register/page.tsx`:
  - Client component (`'use client'`)
  - Form with full_name, email, password, confirm_password (Zod: full_name min 2 chars, email valid, password min 6, confirm must match via `.refine()`)
  - On submit: call `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
  - On success: show "Check your email for confirmation link" message
  - On error: display error (e.g., "User already registered")
  - Link to `/login` at bottom
- [x] Create `src/app/(auth)/layout.tsx`:
  - Centered layout (flex, min-h-screen, items-center, justify-center)
  - Check if user is already authenticated → redirect to `/dashboard`
- [x] Create `src/app/api/auth/callback/route.ts`:
  - Extract `code` from `searchParams`
  - Exchange code for session via `supabase.auth.exchangeCodeForSession(code)`
  - Redirect to `/dashboard` (with optional `next` param support)
- [ ] Verify: register a new user → profile auto-created in `profiles` table via trigger → login succeeds → redirected to `/dashboard`
- [ ] **Dev-mode admin setup**: After registering your own account, promote to admin via SQL: `UPDATE profiles SET role = 'admin' WHERE email = 'your-dev@email.com'` — needed to test admin features in Phases 3 and 5

### 1.3 Middleware (Auth Guard + Admin Guard)
- [x] Create `src/proxy.ts` *(Next.js 16 uses `proxy.ts` not `middleware.ts`)*:
  - Create Supabase server client using `createServerClient` from `@supabase/ssr` with request cookies
  - Call `supabase.auth.getUser()` to get current user
  - Define protected paths: `/dashboard`, `/chatbots`, `/conversations`, `/api/chatbots`, `/api/conversations`
  - If path is protected AND no user → redirect to `/login` (with `next` param)
  - Auth routes (`/login`, `/register`): redirect authenticated users to `/dashboard`
  - Export `config.matcher` excluding `_next/static`, `_next/image`, `favicon.ico`

### 1.4 User Dashboard Layout
- [x] Create `src/app/(dashboard)/layout.tsx`:
  - Server Component — fetch user via `supabase.auth.getUser()`
  - Responsive sidebar navigation (desktop sidebar + mobile header) with links: Dashboard, Chatbots, Conversations
  - Display user name/email + plan in sidebar footer
  - Sign out button (via `SignOutButton` component) → calls `supabase.auth.signOut()` → redirect to `/login`
  - Main content area: `{children}`
- [x] Create `src/app/(dashboard)/dashboard/page.tsx`:
  - Server Component — fetch stats from Supabase via `Promise.all()`:
    - Total chatbots count
    - Total conversations count
    - Total messages count
  - Display in stat cards with icons (3-column responsive grid)

### 1.5 Chatbot CRUD
- [x] Create `src/app/api/chatbots/route.ts`:
  - `GET`: Fetch all chatbots for authenticated user, ordered by created_at DESC
  - `POST`: Validate body with Zod (name min 1, max 100; domain min 1, max 255) → return 201 with chatbot
- [x] Create `src/app/api/chatbots/[id]/route.ts`:
  - `GET`: Fetch single chatbot by id with ownership validation
  - `PATCH`: Validate partial update body (supports all chatbot fields) → update with ownership check
  - `DELETE`: Delete with ownership validation
- [x] Create `src/app/(dashboard)/chatbots/page.tsx`:
  - Client Component — uses `useChatbots()` hook
  - Display as 3-column responsive card grid: name, domain, active/inactive badge
  - "New Chatbot" button → links to `/chatbots/new`
  - Each chatbot card links to `/chatbots/[id]`
  - Empty state with icon and CTA
- [x] Create `src/app/(dashboard)/chatbots/new/page.tsx`:
  - Client Component — renders `ChatbotForm`, uses `useCreateChatbot()` mutation
  - On submit: POST `/api/chatbots` → on success toast + redirect to `/chatbots/[newId]`
- [x] Create `src/app/(dashboard)/chatbots/[id]/page.tsx`:
  - Client Component — uses `useChatbot(id)` hook
  - Overview tab: name, domain, status, LLM provider/model, created date
  - Embed Code tab: renders `EmbedCodeBlock`
  - Delete button with confirmation dialog

### 1.5b Shared Components, Hooks & Stores
- [x] Create `src/components/chatbot/ChatbotForm.tsx` — reusable form component for create/edit chatbot (name, domain fields, RHF + Zod, Card wrapper)
- [x] Create `src/components/chatbot/EmbedCodeBlock.tsx` — displays `<script>` tag with copy-to-clipboard button, toast feedback
- [x] Create `src/hooks/useChatbots.ts`:
  - `useChatbots()` — TanStack Query `useQuery` that fetches `GET /api/chatbots`
  - `useChatbot(id)` — fetches single chatbot by ID
  - `useCreateChatbot()` — TanStack Query `useMutation` that POSTs to `/api/chatbots`, invalidates `['chatbots']` on success
  - `useDeleteChatbot()` — TanStack Query `useMutation` that DELETEs `/api/chatbots/[id]`, invalidates `['chatbots']` on success
- [x] Create `src/hooks/useConversations.ts`:
  - `useConversations(chatbotId?)` — TanStack Query `useQuery` with optional chatbotId filter
  - `useConversation(id)` — fetches single conversation with messages
- [x] Create `src/hooks/useDocuments.ts`:
  - `useDocuments(chatbotId)` — TanStack Query `useQuery` for `GET /api/chatbots/[id]/documents`
  - `useUploadDocument()` — mutation that POSTs FormData *(note: API endpoint not yet created — Phase 2)*
- [x] Create `src/stores/chatbotStore.ts` — Zustand store:
  - State: `selectedChatbotId`, `sidebarOpen`
  - Actions: `setSelectedChatbotId(id)`, `setSidebarOpen(open)`

### 1.6 Domain Configuration
- [x] On chatbot overview page (`/chatbots/[id]`), display current domain
- [ ] Allow editing domain via inline edit or settings sub-page *(domain is read-only on detail page — editable only via ChatbotForm on create)*
- [ ] Validate domain format: no protocol (strip `https://`), no trailing slash, must contain a dot *(basic min/max validation only)*
- [x] On save: PATCH `/api/chatbots/[id]` with `{ domain: cleanedDomain }` *(PATCH endpoint supports domain updates)*

### 1.7 Chat API (OpenAI Only, MVP)
- [x] Create `src/app/api/chat/[chatbotId]/route.ts` — `POST` handler:
  1. **Rate limiting**: Extract IP → call `chatRatelimit.limit(ip)` → if `!success` return 429
  2. **Parse request**: Extract messages array from body → validate presence → return 400 if missing
  3. **Fetch chatbot**: from DB checking `active` status → return 404 if not found
  4. **Domain verification**: Compare request origin with `chatbot.domain` → return 403 if mismatch
  5. **Account active check**: Fetch profile by `chatbot.user_id` → check `is_active` + message limits
  6. **Usage limits**: If `profile.message_count >= profile.message_limit` return 402
  7. **Get/create conversation**: Creates new or uses existing `conversationId`
  8. **Fetch history**: Messages from conversation
  9. **Build system prompt**: Uses `chatbot.personality_prompt`
  10. **Stream response**: `streamText()` with `toTextStreamResponse()` *(AI SDK v6 pattern)*
  11. **onFinish callback**: Saves assistant message, updates conversation, increments message count *(direct UPDATE, not RPC)*
  12. **CORS headers**: Applied to streaming response
- [x] Create `OPTIONS` handler for CORS preflight — returns 204 with CORS headers

### 1.8 Widget Script
- [x] Create `src/app/api/widget/[chatbotId]/route.ts` — `GET` handler:
  1. Extract chatbotId from params
  2. Fetch chatbot config (id, name, primary_color, welcome_message, quick_actions, widget_position)
  3. If not found → return 404
  4. Build self-contained IIFE script string with:
     - CSS injection (widget styles)
     - DOM creation: container, toggle button, chat window, input area, messages container
     - `sendMessage()` function with streaming response handling via `ReadableStream` + `TextDecoder`
     - `renderMessages()` function with user/assistant styling
     - All user-controlled values use `textContent` NOT `innerHTML` (XSS prevention)
     - Auto-detect API base from script source
  5. Return with `Content-Type: application/javascript`, `Cache-Control: max-age=300, s-maxage=600`
- [x] Embed code accessible via `EmbedCodeBlock` component on chatbot detail page (Embed Code tab)

### 1.9 Conversation Viewer
- [x] Create `src/app/api/conversations/route.ts`:
  - `GET`: Auth check, filter by chatbotId + status params, scoped to user's chatbots, ordered by updated_at DESC
- [x] Create `src/app/api/conversations/[id]/route.ts`:
  - `GET`: Auth check, await params (Next.js 16), ownership verification, returns conversation + all messages ordered by created_at ASC
- [x] Create `src/app/api/conversations/[id]/status/route.ts`:
  - `PATCH`: Validates status against allowed values, ownership check, updates status + updated_at
- [x] Create `src/app/(dashboard)/conversations/page.tsx`:
  - Client Component with `useConversations()` + `useChatbots()` hooks
  - Filter by chatbot + status (client-side filtering)
  - Renders `ConversationList` component
- [x] Create `src/app/(dashboard)/conversations/[id]/page.tsx`:
  - Client Component — uses `useConversation(id)` hook
  - Displays visitor metadata, status badge with color mapping
  - Status change via Select dropdown → PATCH to API with toast feedback
  - Renders `ConversationThread` component with messages
- [x] Create `src/components/conversations/ConversationList.tsx` — table with filter dropdowns, clickable rows, status badges, date formatting
- [x] Create `src/components/conversations/ConversationThread.tsx` — auto-scroll to bottom, maps messages to `MessageBubble` components
- [x] Create `src/components/conversations/MessageBubble.tsx` — role-based styling (user right-aligned, assistant left-aligned, tool with dashed border), timestamps, XSS-safe content rendering

#### Phase 1 — Unit Tests
- [x] **Proxy test** (`src/proxy.test.ts`) — 7 tests:
  - Test: redirects unauthenticated user from `/dashboard` to `/login`
  - Test: redirects unauthenticated user from `/chatbots` to `/login`
  - Test: includes `next` param in redirect URL
  - Test: redirects authenticated user from `/login` to `/dashboard`
  - Test: allows authenticated user to access `/dashboard`
  - Test: allows unauthenticated user to access public routes
  - Test: exports a matcher config
- [x] **Chat API route test** (`src/app/api/chat/[chatbotId]/route.test.ts`) — 7 tests:
  - Test: returns 429 when rate limited
  - Test: returns 400 when messages array is missing
  - Test: returns 404 when chatbot not found
  - Test: returns 403 when domain doesn't match
  - Test: returns 402 when message limit exceeded
  - Test: OPTIONS returns 204 with CORS headers
- [x] **Chatbot API route test** (`src/app/api/chatbots/route.test.ts`) — 4 tests:
  - Test: GET returns chatbots for authenticated user
  - Test: GET returns 401 for unauthenticated user
  - Test: POST creates a chatbot with valid data
  - Test: POST returns 400 for invalid data
- [x] **Rate limiter test** (`src/lib/ratelimit.test.ts`) — 3 tests:
  - Test: exports `chatRatelimit` instance
  - Test: has a `limit` method
  - Test: resolves with success on limit check
- [x] **ConversationList component test** (`src/components/conversations/ConversationList.test.tsx`) — 3 tests:
  - Test: renders conversations in a table
  - Test: shows loading state
  - Test: renders status badges with correct text
- [x] Verify: `npm test` passes all 23 tests

#### Phase 1 — Acceptance Criteria
- [x] User can register with email/password → receives confirmation email → profile auto-created in DB *(code implemented, needs runtime verification)*
- [x] User can login → redirected to `/dashboard`
- [x] Unauthenticated users cannot access `/dashboard` or `/chatbots` (redirected to `/login`)
- [x] User can create a new chatbot with name + domain
- [x] User can see list of their chatbots on `/chatbots`
- [x] User can view chatbot details on `/chatbots/[id]`
- [x] User can delete a chatbot (with confirmation)
- [x] Chat API (`POST /api/chat/[chatbotId]`) works with valid request from matching origin → returns streaming response
- [x] Chat API returns 429 when rate limited, 403 for wrong domain, 402 for exceeded limits
- [x] Widget script loads at `/api/widget/[chatbotId]` → renders chat bubble on external page
- [x] Widget: clicking bubble opens chat window, typing message + send → receives streamed AI response
- [x] Widget: conversation continuity via conversationId
- [x] Conversation viewer shows list of conversations filtered by chatbot
- [x] Clicking a conversation shows full message thread
- [x] Embed page shows correct `<script>` tag with copy-to-clipboard

---

## Phase 2 — Knowledge Base & RAG

### 2.1 Supabase Storage Bucket
- [x] Create storage bucket named `knowledge-docs` in Supabase dashboard (or via migration)
- [x] Set bucket to private (files accessed via signed URLs or service role only)
- [x] Set max file size: 10MB
- [x] Set allowed MIME types: `application/pdf`, `text/plain`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 2.2 Document Upload API
- [x] Create `src/app/api/chatbots/[id]/documents/route.ts`:
  - `POST`: Accept `multipart/form-data` with file field
  - Validate authenticated user owns the chatbot
  - Validate MIME type (PDF, TXT, DOCX only) → return 400 if invalid
  - Validate file size ≤ 10MB → return 400 if too large
  - Upload to Supabase Storage: path `${user.id}/${chatbotId}/${filename}`
  - Insert record into `knowledge_documents` table with status `'pending'`
  - Use `after()` from `next/server` to trigger background processing (do NOT await)
  - Return 201 with document record (status: pending)
  - `GET`: List all documents for the chatbot → `supabaseAdmin.from('knowledge_documents').select('*').eq('chatbot_id', id).order('created_at', { ascending: false })`

### 2.3 RAG Pipeline Implementation
- [x] Create `src/lib/rag.ts` with three exported functions:

**`chunkText(text: string, maxChunkSize: number, overlap: number): string[]`**
  - Split text into chunks of `maxChunkSize` characters with `overlap` character overlap
  - Try to split at sentence boundaries (`.`, `!`, `?`) when possible
  - Return array of chunk strings
  - Handle empty text → return `[]`

**`embedText(text: string): Promise<number[]>`**
  - Call `openai.embeddings.create({ model: 'text-embedding-3-small', input: text })`
  - Return `response.data[0].embedding` (array of 1536 floats)

**`searchSimilarChunks(query: string, chatbotId: string, matchCount: number): Promise<{content: string, similarity: number}[]>`**
  - Call `embedText(query)` to get query embedding
  - Call `supabaseAdmin.rpc('match_chunks', { query_embedding, chatbot_id_param: chatbotId, match_count: matchCount, match_threshold: 0.7 })`
  - If error or null data → return `[]`
  - Return results array

### 2.4 Background Document Processing
- [x] Inside the `after()` callback in the documents POST route:
  1. Update document status to `'processing'`
  2. Download file from Supabase Storage
  3. Extract text based on MIME type:
     - PDF: use `pdf-parse` package (install: `npm install pdf-parse`)
     - TXT: read as UTF-8 string
     - DOCX: use `mammoth` package (install: `npm install mammoth`) → extract raw text
  4. Chunk text: call `chunkText(extractedText, 500, 50)`
  5. For each chunk: call `embedText(chunk)` → INSERT into `document_chunks` table with `document_id`, `chatbot_id`, `content`, `embedding`, `chunk_index`
  6. Update document status to `'ready'`
  7. On any error: update document status to `'error'`, set `error_message`

### 2.5 RAG Injection in Chat API
- [x] In `src/app/api/chat/[chatbotId]/route.ts`, after building system prompt:
  - Call `searchSimilarChunks(message, chatbot.id, 5)`
  - If results found, append to system prompt: `\n\nRelevant knowledge base context:\n${chunks.map(c => c.content).join('\n\n')}`

### 2.6 Document Upload UI
- [x] Create `src/components/knowledge/DocumentUpload.tsx`:
  - File input accepting `.pdf`, `.txt`, `.docx`
  - Drag-and-drop zone (optional but nice)
  - Upload progress indicator
  - On file select: POST to `/api/chatbots/[id]/documents` as FormData
- [x] Create Knowledge tab in chatbot detail page (`src/app/(dashboard)/chatbots/[id]/page.tsx`):
  - Server Component — fetch documents list for chatbot
  - Display table: file_name, file_size (formatted), status badge (pending=yellow, processing=blue, ready=green, error=red), created date
  - Upload button/area at top
  - Delete button per document

### 2.7 Install Processing Dependencies
- [x] `npm install pdf-parse mammoth`
- [x] Add `@types/pdf-parse` if needed: `npm install -D @types/pdf-parse`

#### Phase 2 — Unit Tests
- [x] **RAG test** (`src/lib/rag.test.ts`):
  - Test `chunkText`: returns single chunk for short text
  - Test `chunkText`: splits long text into overlapping chunks (verify overlap exists)
  - Test `chunkText`: returns empty array for empty text
  - Test `chunkText`: preserves sentence boundaries when possible
  - Test `searchSimilarChunks`: calls Supabase RPC with correct parameters
  - Test `searchSimilarChunks`: returns results array on success
  - Test `searchSimilarChunks`: returns empty array when no matches
  - Test `searchSimilarChunks`: returns empty array on RPC error
- [x] **Document upload route test** (`src/app/api/chatbots/[id]/documents/route.test.ts`):
  - Test: returns 400 for invalid MIME type
  - Test: returns 400 for file > 10MB
  - Test: returns 201 with document record (status: pending) on success
  - Test: GET returns list of documents for chatbot

#### Phase 2 — Acceptance Criteria
- [x] User can upload a PDF file → document appears with "pending" status
- [x] Document status transitions: pending → processing → ready
- [x] If extraction fails, document shows "error" status with error message
- [x] After document is ready, chat API returns answers that reference document content
- [x] Chat without relevant documents returns generic AI response (RAG doesn't inject irrelevant content)
- [x] User can see list of uploaded documents with statuses
- [x] User can delete a document (chunks are cascade-deleted)
- [x] File type validation: uploading `.exe` returns 400 error
- [x] File size validation: uploading >10MB file returns 400 error

---

## Phase 3 — Multi-LLM, AI Tools & Enquiry Forms

### 3.1 Multi-LLM Provider Factory
- [x] Create `src/lib/ai/provider.ts`:
  - Define type `ProviderName = 'openai' | 'anthropic' | 'google'`
  - Define interface `ChatbotAIConfig { llm_provider: ProviderName; llm_model: string }`
  - Export `async function getModelForChatbot(chatbot: ChatbotAIConfig)`:
    1. Call `getPlatformKey(chatbot.llm_provider)` → if null, throw `No API key available for provider: ${provider}`
    2. Switch on `chatbot.llm_provider`:
       - `'openai'`: `createOpenAI({ apiKey })` → return `provider(chatbot.llm_model)`
       - `'anthropic'`: `createAnthropic({ apiKey })` → return `provider(chatbot.llm_model)`
       - `'google'`: `createGoogleGenerativeAI({ apiKey })` → return `provider(chatbot.llm_model)`
       - default: throw `Unknown provider`
  - `async function getPlatformKey(provider: ProviderName): Promise<string | null>`:
    - Query `supabaseAdmin.from('llm_providers').select('platform_api_key').eq('name', provider).eq('is_enabled', true).single()`
    - Return `data?.platform_api_key || null`

### 3.2 Update Chat API to Use Multi-LLM
- [x] In `src/app/api/chat/[chatbotId]/route.ts`:
  - Replace hardcoded `openai('gpt-4o')` with `await getModelForChatbot(chatbot)`
  - Import `getModelForChatbot` from `@/lib/ai/provider`
  - Import `getChatbotTools` from `@/lib/ai/tools`
  - Pass tools to `streamText({ ..., tools, maxSteps: 3 })`
  - In `onFinish`, save tool results as messages with `role: 'tool'`

### 3.3 AI SDK Tools Builder
- [x] Create `src/lib/ai/tools.ts`:
  - `function fieldToZod(type: string, required: boolean)`: map field types to Zod schemas (string, email → z.string().email(), number → z.number(), phone → z.string(), textarea → z.string(), date → z.string(), select → z.string()) — if not required, wrap with `.optional()`
  - Define `EnquiryFormField` interface: `{ name, label, type, required?, options? }`
  - Export `async function getChatbotTools(chatbotId, conversationId?, visitorId?, visitorIp?)`:
    1. Fetch `enquiry_forms` from Supabase where `chatbot_id = chatbotId` and `is_enabled = true`
    2. Fetch `chatbot_tools` from Supabase where `chatbot_id = chatbotId` and `is_enabled = true`
    3. For each enquiry form:
       - Build Zod schema from `form.fields` using `fieldToZod()`
       - Create tool with key `enquiry_${form.name}`:
         - `description`: `form.description`
         - `parameters`: `z.object(schemaShape)`
         - `execute`: async function that:
           a. Sets `webhookStatus = 'none'`
           b. If `form.webhook_url` exists: POST form data to webhook URL → set `webhookStatus` to `'sent'` or `'failed'`, capture `res.status`
           c. INSERT into `enquiries` table: enquiry_form_id, chatbot_id, conversation_id, form_name (display_name), data (params), visitor_id, visitor_ip, webhook_status, webhook_response_code
           d. Return `{ success: true, form: form.name, message: form.success_message }`
    4. For each chatbot_tool:
       - Build Zod schema from `dbTool.parameters`
       - Create tool with key `dbTool.name`
    5. Return all tools as `Record<string, any>`

### 3.4 Admin Dashboard: LLM Provider Management
- [x] Create `src/app/api/admin/providers/route.ts`:
  - `GET`: Verify admin role → fetch all `llm_providers` → return array
  - `PATCH`: Verify admin role → validate body (id required, optional fields: platform_api_key, is_enabled, models) → update provider → return updated
- [x] Create `src/app/(admin)/layout.tsx`:
  - Server Component — verify admin role, redirect to `/dashboard` if not admin
  - Admin sidebar: Dashboard, Users, Providers, Analytics, Settings
- [x] Create `src/app/(admin)/admin/providers/page.tsx`:
  - Fetch all LLM providers
  - For each provider: show name, enabled toggle, API key field (masked, editable), models list
  - Save button per provider → PATCH `/api/admin/providers`
- [x] Create `src/components/admin/ProviderForm.tsx`:
  - Form fields: API key (password input with show/hide toggle), enabled (switch), models (display as read-only list for now)

### 3.5 Model Selector Per Chatbot
- [x] Create `src/app/(dashboard)/chatbots/[id]/model/page.tsx`:
  - Fetch enabled LLM providers (via Supabase client, RLS allows reading enabled providers)
  - Display providers as cards/radio group: OpenAI, Anthropic, Google
  - Under each provider: dropdown of available models (from `provider.models` jsonb)
  - Current selection highlighted
  - Save button → PATCH `/api/chatbots/[id]` with `{ llm_provider, llm_model }`
- [x] Create `src/components/chatbot/ModelSelector.tsx`:
  - Props: providers list, currentProvider, currentModel, onSave
  - Radio group for provider selection
  - Select dropdown for model (changes options based on selected provider)

### 3.6 Chatbot Tools CRUD
- [x] Create `src/app/api/chatbots/[id]/tools/route.ts`:
  - `GET`: Fetch tools for chatbot → `supabase.from('chatbot_tools').select('*').eq('chatbot_id', id)`
  - `POST`: Validate body (name, description, parameters) → INSERT → return 201
  - `DELETE`: Accept tool id in body or query → DELETE from chatbot_tools
- [x] Create `src/app/(dashboard)/chatbots/[id]/tools/page.tsx`:
  - List existing tools with name, description, enabled status
  - Add tool form: name (text), description (textarea), parameters (key-value builder: name → type)
  - Delete button per tool
- [x] Create `src/components/chatbot/ToolsForm.tsx`:
  - Dynamic form: add/remove parameter rows (name input + type select)

### 3.7 Enquiry Form Builder
- [x] Create `src/app/api/chatbots/[id]/enquiry-forms/route.ts`:
  - `GET`: Fetch enquiry forms for chatbot
  - `POST`: Validate body with Zod:
    - name: string, min 1, snake_case pattern
    - display_name: string, min 1
    - description: string, min 10 (AI needs good descriptions)
    - fields: array of `{ name, label, type, required?, options? }` — at least 1 field
    - webhook_url: optional, must be valid URL if provided
    - success_message: optional string
  - INSERT into `enquiry_forms` → return 201
  - `PATCH`: Update existing form → validate partial body → UPDATE
  - `DELETE`: Delete form by id

- [x] Create `src/app/(dashboard)/chatbots/[id]/enquiry-forms/page.tsx`:
  - List existing enquiry forms: name, display_name, field count, webhook status (configured/none), enabled toggle
  - "Create New Form" button → opens modal or navigates to creation view
  - Edit/delete per form

- [x] Create enquiry form builder component (could be a modal or page):
  - Form name (slug-style, auto-generated from display_name)
  - Display name
  - Description (textarea — explain to AI when to trigger this form)
  - Dynamic field builder:
    - "Add Field" button → adds a row
    - Per field: name (auto slug from label), label, type dropdown (string/email/phone/number/textarea/select/date), required checkbox
    - If type is `select`: show options input (comma-separated or individual add)
    - Reorder fields (drag or up/down buttons)
    - Remove field button
  - Webhook URL (optional text input — validated as URL)
  - Success message (text input with default)
  - Save button

### 3.8 Enquiry Dashboard
- [x] Create `src/app/api/enquiries/route.ts`:
  - `GET`: Fetch enquiries with filters (chatbot_id, form_name, is_read) → join with enquiry_forms(display_name) → order by created_at desc → limit 50
- [x] Create `src/app/api/enquiries/[id]/route.ts`:
  - `GET`: Fetch single enquiry with full data
  - `PATCH`: Mark as read → `{ is_read: true }`
- [x] Create `src/app/api/enquiries/export/route.ts`:
  - `GET`: Verify authenticated user → accept query params (chatbot_id?, form_name?, date_from?, date_to?) → fetch matching enquiries → return as CSV download (set `Content-Type: text/csv`, `Content-Disposition: attachment; filename="enquiries-export.csv"`)
  - CSV columns: id, form_name, all data fields (flattened from jsonb), visitor_ip, webhook_status, created_at
- [x] Create `src/app/(dashboard)/enquiries/page.tsx`:
  - Server Component — fetch enquiries
  - Filter by: chatbot (dropdown), form (dropdown), read status (all/unread/read)
  - Table: form_name, visitor_ip, data preview (first 2 fields), webhook status badge, read status, created_at
  - Click row → navigate to `/enquiries/[id]`
  - Unread count badge in sidebar navigation
  - **Export button** → calls `GET /api/enquiries/export` with current filters → triggers CSV download
- [x] Create `src/app/(dashboard)/enquiries/[id]/page.tsx`:
  - Full enquiry detail: all form fields displayed as key-value pairs
  - Webhook status and response code
  - Conversation link (if conversation_id exists)
  - Mark as read button (if unread)
  - Auto-mark as read on page load

### 3.9 Widget: Render Enquiry Forms Inline
- [x] Update widget script to handle tool call responses (`9:` prefix in SSE stream):
  - When tool result is received, call `renderForm(toolName, args)`
  - `renderForm` creates form DOM: labels + inputs based on parameter names/types
  - Submit button collects field values → sends as message back to chat API
  - After submit, replace form with success message

#### Phase 3 — Unit Tests
- [x] **Provider factory test** (`src/lib/ai/provider.test.ts`):
  - Test: returns OpenAI model instance when provider is 'openai'
  - Test: returns Anthropic model instance when provider is 'anthropic'
  - Test: returns Google model instance when provider is 'google'
  - Test: throws error when no API key found for provider
  - Test: throws error for unknown provider name
- [x] **Tools builder test** (`src/lib/ai/tools.test.ts`):
  - Test: returns empty object when no forms or tools exist
  - Test: creates tool with correct key (`enquiry_${name}`) for each enquiry form
  - Test: tool execution stores enquiry in database (no webhook case, webhook_status = 'none')
  - Test: tool execution forwards to webhook AND stores when webhook_url is set (webhook_status = 'sent')
  - Test: tool execution marks webhook_status as 'failed' when webhook network error
  - Test: tool execution marks webhook_status as 'failed' when webhook returns non-ok (e.g., 500)
  - Test: tool still returns success even when webhook fails (enquiry is always stored)
- [x] **Admin providers route test** (`src/app/api/admin/providers/route.test.ts`):
  - Test: GET returns all providers for admin user
  - Test: PATCH updates provider API key and enabled status
  - Test: non-admin user gets 403
- [x] **Enquiry forms route test**:
  - Test: GET returns forms for chatbot
  - Test: POST creates form with valid body
  - Test: POST returns 400 for missing required fields
  - Test: DELETE removes form
- [x] **Enquiries route test**:
  - Test: GET returns enquiries filtered by chatbot
  - Test: PATCH marks enquiry as read

#### Phase 3 — Acceptance Criteria
- [x] Admin can enable/disable LLM providers and set API keys in admin dashboard
- [x] User can select LLM provider + model per chatbot
- [x] Chat API uses the selected provider's model (not hardcoded OpenAI)
- [x] Switching from OpenAI to Anthropic model works with no code changes
- [x] User can create/edit/delete chatbot tools
- [x] User can create enquiry forms with custom fields (string, email, phone, select, etc.)
- [x] AI presents enquiry form mid-conversation when context matches the form's description
- [x] Widget renders enquiry form inline as input fields
- [x] Form submission is ALWAYS stored in `enquiries` table (verify in Supabase)
- [x] If webhook URL is configured, data is POSTed to webhook with correct payload
- [x] If webhook fails (network error or 500), enquiry is still stored with `webhook_status = 'failed'`
- [x] Enquiry dashboard shows all submissions, filterable by chatbot and form
- [x] Clicking an enquiry shows full detail with all field values
- [x] Unread enquiries show badge count in sidebar
- [x] User can export enquiries as CSV (filtered by chatbot/form/date range)

---

## Phase 4 — Personality, Skills & Quick Actions

### 4.1 Personality Form
- [x] Create `src/components/chatbot/PersonalityForm.tsx`:
  - React Hook Form + Zod (name min 1 max 100, personality_prompt max 2000, welcome_message min 1 max 500)
  - Character counter for personality_prompt
  - Success toast on save, error toast on failure
  - Pre-fill form with chatbot's current values
- [x] Add Personality tab to chatbot detail page (`src/app/(dashboard)/chatbots/[id]/page.tsx`)

### 4.2 Skills Selector
- [x] Create `src/components/chatbot/SkillsSelector.tsx`:
  - Predefined skill list: `['answer_faqs', 'book_appointment', 'product_recommendations', 'technical_support', 'order_tracking', 'general_enquiry']`
  - Display as checkbox grid with labels and descriptions
  - Current chatbot skills pre-checked
  - Save → PATCH `/api/chatbots/[id]` with `{ skills: selectedSkills }`
- [x] Skills injected into system prompt in chat API (e.g., "You can help with: FAQs, booking appointments")
- [x] Add Skills tab to chatbot detail page

### 4.3 Quick Action Buttons Editor
- [x] Create `src/components/chatbot/QuickActionsForm.tsx`:
  - Dynamic form with `useFieldArray` from React Hook Form
  - Zod: array of `{ label: string (min 1, max 30), prompt: string (min 1) }`
  - Add/remove/reorder (up/down arrows) actions
  - Save → PATCH `/api/chatbots/[id]` with `{ quick_actions: actionsArray }`
- [x] Add Quick Actions tab to chatbot detail page

### 4.4 Widget Customization
- [x] Create `src/components/chatbot/WidgetSettings.tsx`:
  - Color picker for `primary_color` (native + text input with live preview)
  - Position selector: `bottom-right` / `bottom-left`
  - Save → PATCH `/api/chatbots/[id]` with `{ primary_color, widget_position }`
- [x] Widget script fetches quick_actions, renders as pill buttons, sends prompt on click
- [x] Add Widget tab to chatbot detail page

### 4.5 Live Preview (Optional Enhancement)
- [ ] Create a preview component on the chatbot overview page:
  - iframe or inline rendering of the widget with current chatbot config
  - Updates in real-time as user changes settings
  - Non-functional (no actual chat, just UI preview)

#### Phase 4 — Unit Tests
- [x] **PersonalityForm component test** (`src/components/chatbot/PersonalityForm.test.tsx`):
  - Test: renders form with initial values pre-filled
  - Test: shows validation error when name is empty
  - Test: submits form with updated values (fetch called with correct data)
  - Test: displays error toast when submission fails
- [x] **QuickActionsForm test** (`src/components/chatbot/QuickActionsForm.test.tsx`):
  - Test: renders existing actions
  - Test: add action adds a new row
  - Test: remove action removes the row
  - Test: validation fails for empty label
  - Test: save sends correct array to API

#### Phase 4 — Acceptance Criteria
- [x] User can edit chatbot name, personality prompt, and welcome message
- [x] Personality prompt appears in chat AI's system prompt (verify via AI response tone)
- [x] User can select/deselect skills (verify saved to DB)
- [x] User can add/remove/reorder quick action buttons
- [x] Quick action buttons appear in widget chat window
- [x] Clicking a quick action button sends the configured prompt as a message
- [x] User can change widget color → widget reflects new color
- [x] User can change widget position (bottom-right / bottom-left) → widget moves accordingly

---

## Phase 5 — Admin CRM & Analytics

### 5.1 Admin Dashboard Overview
- [x] Create `src/app/(admin)/admin/page.tsx` — admin dashboard with StatsCards
- [x] Create `src/app/api/admin/stats/route.ts` — system-wide metrics API
- [x] Create `src/components/admin/StatsCards.tsx` — 6 stat cards with icons and loading states

### 5.2 Admin CRM: User Table
- [x] Create `src/app/api/admin/users/route.ts` — GET all profiles with chatbot count
- [x] Create `src/app/api/admin/users/[id]/route.ts` — GET detail + PATCH update (plan/status/role)
- [x] Create `src/app/(admin)/admin/users/page.tsx` — user list page
- [x] Create `src/components/admin/UserTable.tsx` — searchable/sortable table with plan badges
- [x] Create `src/hooks/useAdminUsers.ts` — useAdminUsers, useAdminUser, useUpdateAdminUser hooks

### 5.3 Admin User Detail
- [x] Create `src/app/(admin)/admin/users/[id]/page.tsx` — user detail page
- [x] Create `src/components/admin/UserDetail.tsx` — profile card, usage bar, chatbot list

### 5.4 Admin: Change User Plan & Status
- [x] Plan change dropdown on user detail (free/pro/enterprise with message_limit auto-update)
- [x] Activate/deactivate toggle on user detail
- [x] Chat API checks `profile.is_active` → returns 403 "Account suspended" when deactivated

### 5.5 Admin: System Settings Page
- [x] Create `supabase/migrations/004_platform_settings.sql` — key-value settings table with defaults
- [x] Create `src/app/api/admin/settings/route.ts` — GET/PATCH settings API
- [x] Create `src/app/(admin)/admin/settings/page.tsx` — settings form (rate limit, file size, plan definitions)

### 5.6 Admin: Impersonate User (Read-Only)
- [x] Create `src/app/api/admin/impersonate/route.ts` — GET status, POST start, DELETE end
- [x] `x-impersonate-user-id` httpOnly cookie with 1hr expiry
- [x] proxy.ts blocks non-GET/HEAD/OPTIONS during impersonation (read-only)
- [x] "Impersonate User" button on admin user detail page
- [x] `ImpersonationBanner` component in dashboard layout with "Exit Impersonation" button

### 5.7 Analytics API
- [x] Install recharts
- [x] Create `src/app/api/admin/analytics/route.ts` — plan breakdown, users/messages per day, top chatbots, MRR
- [x] Create `src/app/(admin)/admin/analytics/page.tsx` — line chart, bar chart, pie chart, date range selector

### 5.8 User-Level Analytics
- [x] Enhanced user dashboard (`/dashboard`) with:
  - 4 stat cards (chatbots, conversations, messages, enquiries)
  - Message usage progress bar with plan name and warning at 90%+

#### Phase 5 — Unit Tests
- [x] **Admin users route test** (`src/app/api/admin/users/route.test.ts`):
  - Test: GET returns all users for admin
  - Test: GET returns 403 for non-admin
  - Test: GET returns 403 for unauthenticated
- [x] **UserTable component test** (`src/components/admin/UserTable.test.tsx`):
  - Test: renders user rows with correct data
  - Test: shows plan badges
  - Test: shows active/inactive status
  - Test: search filters users by name
  - Test: search filters users by email
  - Test: shows user count

#### Phase 5 — Acceptance Criteria
- [x] Admin dashboard shows system-wide metrics (users, chatbots, conversations, messages)
- [x] Admin can see all registered users in a searchable, sortable table
- [x] Admin can view user detail page (profile, chatbots, usage)
- [x] Admin can change a user's plan (free/pro/enterprise) → message_limit updates accordingly
- [x] Admin can deactivate a user → user's chatbots stop responding to chat requests (returns 403 "Account suspended")
- [x] Admin can reactivate a user → chatbots work again
- [x] Admin can configure platform settings (rate limits, file size, plan definitions)
- [x] Admin can impersonate a user (read-only view of their dashboard)
- [x] Impersonation shows visual banner and prevents mutations
- [x] Analytics page shows charts (user growth, message volume, plan distribution, revenue)
- [x] User's own dashboard shows their usage stats (messages used vs limit)

---

## Phase 6 — Testing (Ongoing, Parallel)

> **NOTE:** This phase runs in parallel with Phases 1–5 and 7. Tests for each phase are listed within that phase's section above. This section covers the cross-cutting testing infrastructure and final coverage gates.

### 6.1 Test Infrastructure (Already done in Phase 0.6)
- [x] Verify `vitest.config.ts` has correct setup
- [x] Verify `src/test/setup.ts` mocks Next.js modules
- [x] Verify `src/__mocks__/supabase.ts` exports working mock factory

### 6.2 Aggregate Test Verification
- [x] Run `npm test` → ALL tests across all phases pass (164 tests, 19 files, 0 failures)
- [x] Run `npm run test:coverage` → verify thresholds:
  - [x] `src/lib/ai/*`: 98.59% ≥ 90% statements ✅
  - [x] `src/lib/rag.ts`: 91.66% ≥ 85% statements ✅
  - [x] `src/app/api/chat/*`: 100% ≥ 85% statements ✅
  - [x] `src/proxy.ts` (replaces middleware.ts in Next.js 16): 85.36% statements
  - [x] `src/components/*`: ≥ 75% statements ✅ (most 85%+, UI wrappers lower)
  - [x] `src/hooks/*`: 95.71% ≥ 80% statements ✅
  - [x] Overall: 92.22% statements ≥ 80%, 86.25% branches ≥ 75% ✅

### 6.3 Hook Tests
- [x] **useChatbots hook test** (`src/hooks/useChatbots.test.ts`) — 9 tests:
  - Test: `useChatbots()` fetches and returns chatbots list
  - Test: returns error state on fetch failure
  - Test: `useDeleteChatbot()` calls DELETE endpoint and invalidates cache
- [x] **useConversations hook test** (`src/hooks/useConversations.test.ts`) — 7 tests:
  - Test: fetches conversations list with filters
  - Test: returns error state on failure
- [x] **useDocuments hook test** (`src/hooks/useDocuments.test.ts`) — 7 tests:
  - Test: fetches documents for a chatbot
  - Test: upload mutation calls POST endpoint
  - Test: delete mutation calls DELETE endpoint
  - Test: error handling for upload and delete failures

### 6.4 What NOT to Test (Documented Exclusions)
- Supabase client creation files (`client.ts`, `server.ts`, `admin.ts`) — thin SDK wrappers
- Widget script DOM manipulation — test via E2E (Playwright) if needed
- Stripe webhook handler — use Stripe CLI (`stripe listen --forward-to`)
- Database RLS policies — test via Supabase test suite or pgTAP

#### Phase 6 — Acceptance Criteria
- [x] `npm test` passes with 0 failures (164 tests, 19 files)
- [x] `npm run test:coverage` meets all thresholds (92% stmts, 86% branches, 85% funcs, 93% lines)
- [x] No test file is empty or has only skipped tests
- [ ] CI pipeline runs tests on every push (see Phase 0 CI/CD or Deployment section)

---

## Phase 7 — Billing & Plans (EFT — Manual Bank Transfer)

> **Payment Model:** Users transfer funds via bank transfer (EFT), upload a screenshot of the payment proof, and the admin manually approves/rejects. On approval, the user's plan and limits are upgraded. **Stripe is deferred to a Future Iteration.**

### 7.1 Payment Storage Setup
- [x] Create Supabase Storage bucket: `payment-proofs`
  - Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`
  - Max file size: 5MB
  - Storage path pattern: `{user_id}/{filename}`
- [x] Define pricing constants in `src/lib/billing.ts`:
  ```typescript
  export const PLAN_PRICING = {
    pro:        { monthly: 29, yearly: 290 },
    enterprise: { monthly: 99, yearly: 990 },
  } as const
  export const PLAN_LIMITS = {
    free:       { messages: 100,   chatbots: 1 },
    pro:        { messages: 5000,  chatbots: 5 },
    enterprise: { messages: 50000, chatbots: 20 },
  } as const
  ```

### 7.2 User Payment Submission API
- [x] Create `src/app/api/payments/route.ts`:
  - `GET`: Authenticate user → query `payments` table where `user_id = auth.uid()` → order by `created_at desc` → return list
  - `POST`: Authenticate user → parse multipart form data (`plan_requested`, `billing_cycle`, `reference_number`, `proof_file`) → validate file (MIME, size) → upload to Supabase Storage at `payment-proofs/{user_id}/{timestamp}_{filename}` → get public URL → insert into `payments` table with `status: 'pending'` and calculated `amount` from `PLAN_PRICING[plan_requested][billing_cycle]` → return created payment
- [x] Create `src/app/api/payments/[id]/route.ts`:
  - `GET`: Authenticate user → fetch payment by `id` where `user_id = auth.uid()` → return payment detail (or 404)

### 7.3 Admin Payment Review API
- [x] Create `src/app/api/admin/payments/route.ts`:
  - `GET`: Verify admin role → query `payments` table with optional `?status=pending` filter → join with `profiles` to get user info (full_name, email, company_name, current plan) → order by `created_at asc` (oldest first) → return list
- [x] Create `src/app/api/admin/payments/[id]/route.ts`:
  - `PATCH`: Verify admin role → accept `{ status: 'approved' | 'rejected', admin_notes? }` → validate `id` exists with status `pending` (return 400 if already reviewed)
  - If `status === 'approved'`:
    1. Calculate `period_start = now()` and `period_end = period_start + (billing_cycle === 'monthly' ? 30 days : 365 days)`
    2. Update payment record: `status = 'approved'`, `reviewed_by = admin.id`, `reviewed_at = now()`, `period_start`, `period_end`
    3. Update user's profile: `plan = plan_requested`, `message_limit = PLAN_LIMITS[plan_requested].messages`, `billing_cycle = payment.billing_cycle`, `billing_period_start = now()`, `message_count = 0`
    4. Return updated payment
  - If `status === 'rejected'`:
    1. Update payment record: `status = 'rejected'`, `reviewed_by = admin.id`, `reviewed_at = now()`, `admin_notes`
    2. Do NOT change user's plan
    3. Return updated payment

### 7.4 Plan Limits Enforcement
- [x] In chat API, verify `profile.message_count < profile.message_limit` (already done in Phase 1.7 step 5)
- [x] Add chatbot count limit per plan:
  - Free: 1 chatbot
  - Pro: 5 chatbots
  - Enterprise: 20 chatbots
- [x] Enforce in POST `/api/chatbots` → count user's chatbots → if at limit, return 402 with message and current plan info

### 7.5 Billing Period Expiry Check
- [x] Add billing period check to the chat API (after usage limit check, before LLM call):
  - If user's plan is NOT `free` AND `billing_period_start + (billing_cycle === 'monthly' ? 30 days : 365 days) < now()`:
    - Downgrade user to free: `plan = 'free'`, `message_limit = 100`, `message_count = 0`
    - Return 402 with message: "Your billing period has expired. Please renew your plan."
- [x] Alternatively (recommended): Create Vercel Cron job (`/api/cron/check-billing`) that runs daily at midnight UTC:
  - Query all profiles where `plan != 'free'` AND `billing_period_start + cycle_duration < now()`
  - Downgrade each to free plan, reset limits
  - Use `CRON_SECRET` env var to protect the endpoint

### 7.6 User Billing Page
- [x] Create `src/app/(dashboard)/billing/page.tsx`:
  - **Current Plan Card**: Show plan name badge, billing cycle (monthly/yearly), message usage (count/limit with progress bar), chatbot usage (count/limit), billing period dates (start → end)
  - **Plan Comparison Table**: Three columns (Free / Pro / Enterprise) showing features, message limits, chatbot limits, pricing for monthly AND yearly (show yearly savings)
  - **Upgrade Section** (if on free or wanting to change plan):
    - Plan selector: radio buttons for Pro / Enterprise
    - Billing cycle toggle: Monthly ($29 or $99) / Yearly ($290 or $990 — "Save ~17%")
    - Bank transfer instructions panel:
      - Bank name, account name, BSB, account number (admin configures these in platform settings)
      - Calculated amount to transfer
      - Note: "Include your email in the transfer reference"
    - Upload payment proof form:
      - Reference number input (text)
      - File upload (drag-and-drop or click, accepts PNG/JPG/WEBP/PDF, max 5MB)
      - Submit button → POST `/api/payments`
    - Success state: "Payment proof submitted! We'll review it within 24 hours."
  - **Payment History Table**: List of past payments with columns: date, plan, amount, billing cycle, status badge (pending=yellow, approved=green, rejected=red), admin notes (if rejected)
- [x] Show plan badge on dashboard sidebar (color-coded: free=gray, pro=blue, enterprise=purple)

### 7.7 Admin Payment Review Page
- [x] Create `src/app/(admin)/admin/payments/page.tsx`:
  - **Pending Payments Section** (prominent, top of page):
    - Table: user name, email, company, current plan → requested plan, billing cycle, amount, reference number, date submitted
    - Each row has "View Proof" button → opens payment proof image in a modal/dialog (load from `proof_url`)
    - Each row has "Approve" and "Reject" buttons
    - Approve → calls `PATCH /api/admin/payments/[id]` with `{ status: 'approved' }` → refreshes list
    - Reject → opens a dialog for admin notes (reason) → calls `PATCH /api/admin/payments/[id]` with `{ status: 'rejected', admin_notes }` → refreshes list
  - **All Payments Section** (below, filterable):
    - Filter tabs: All / Pending / Approved / Rejected
    - Same table columns + status badge + reviewed_by + reviewed_at
  - **Bank Details Display** (sidebar or top): Show the bank account details that users see (for reference)

### 7.8 Platform Bank Details (Admin Settings)
- [x] In admin settings page (Phase 5.5), add a "Bank Transfer Details" section:
  - Editable fields: bank_name, account_name, bsb, account_number, additional_instructions
  - Store in a `platform_settings` row or as a JSON column (simple key-value store)
  - These values are displayed to users on the billing page when they want to upgrade

#### Phase 7 — Unit Tests
- [x] **Payment submission route test** (`src/app/api/payments/route.test.ts`):
  - Test: POST creates payment with correct amount based on plan + cycle
  - Test: POST returns 400 for invalid plan_requested
  - Test: POST returns 400 for missing proof file
  - Test: POST returns 401 for unauthenticated user
  - Test: GET returns only the current user's payments
- [x] **Admin payment review route test** (`src/app/api/admin/payments/[id]/route.test.ts`):
  - Test: PATCH approve updates payment status + user's plan + message_limit
  - Test: PATCH approve sets period_start/period_end correctly for monthly
  - Test: PATCH approve sets period_start/period_end correctly for yearly
  - Test: PATCH reject updates payment status but NOT user's plan
  - Test: PATCH returns 400 if payment is already reviewed (not pending)
  - Test: PATCH returns 403 for non-admin user
- [x] **Chatbot creation limit test** (`src/app/api/chatbots/route.test.ts`):
  - Test: returns 402 when free user tries to create 2nd chatbot
  - Test: allows pro user to create up to 5 chatbots
- [x] **Billing period expiry test**:
  - Test: user with expired billing period is downgraded to free
  - Test: user with active billing period retains their plan

#### Phase 7 — Acceptance Criteria
- [x] User on free plan sees plan comparison and upgrade section on billing page
- [x] User can select plan (Pro/Enterprise) and billing cycle (Monthly/Yearly)
- [x] User sees bank transfer details with calculated amount
- [x] User can upload payment proof (PNG/JPG/WEBP/PDF, max 5MB) with reference number
- [x] After submission, user sees "pending" status in payment history
- [x] Admin sees pending payments on admin payments page
- [x] Admin can view the uploaded proof image in a modal
- [x] Admin can approve a payment → user's plan upgrades immediately, message_limit increases, billing period is set
- [x] Admin can reject a payment with notes → user's plan stays unchanged, rejection reason visible to user
- [x] Free user is blocked from creating more than 1 chatbot (402 error)
- [x] Expired billing period triggers automatic downgrade to free plan
- [ ] **Future Iteration:** Stripe integration for automated online payments

---

## Phase 8 — Deployment & Go-Live

### 8.1 Pre-Deployment Checklist
- [ ] All env vars documented in `.env.example` (7 core + 2 CI/CD secrets noted; Stripe vars commented as Future Iteration)
- [ ] `npm run build` succeeds with 0 errors
- [ ] `npm test` passes with 0 failures
- [ ] `npm run test:coverage` meets all thresholds
- [ ] `npx tsc --noEmit` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] No `.env.local` or secrets committed to git
- [ ] **Security audit**:
  - Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT referenced in any file under `src/app/(dashboard)` or `src/components/` (server-only)
  - Verify payment proof uploads are scoped to `payment-proofs/{user_id}/` (no cross-user access)
  - Verify `personality_prompt` is never returned in the widget JS script (server-side only, injected into system prompt)
  - Verify widget uses `textContent` everywhere — search for `innerHTML` in widget route and confirm zero matches
  - Run `npx next build` and check `.next/` output for any leaked secrets (grep for `sk-`, `sbp_`, `whsec_`)

### 8.2 Vercel Deployment
- [ ] Push code to GitHub repository
- [ ] Import repo in Vercel dashboard
- [ ] Set Framework Preset: Next.js (auto-detected)
- [ ] Set Node.js version: 20.x
- [ ] Set Region: `iad1` (US East, close to Supabase)
- [ ] Add ALL environment variables in Vercel dashboard:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `NEXT_PUBLIC_APP_URL` (set to production URL, e.g., `https://yourdomain.vercel.app`)
  - `CRON_SECRET` (for billing period expiry cron job)
- [ ] Deploy → verify build succeeds
- [ ] **Upgrade to Vercel Pro ($20/mo)** — required for 60s function timeout (streaming chat needs >10s)

### 8.3 Supabase Production Setup
- [ ] Run final migration: `supabase db push`
- [ ] Verify all tables, indexes, triggers, RLS policies, and functions exist
- [ ] Create `knowledge-docs` storage bucket (if not already created)
- [ ] Seed LLM providers (run INSERT from plan Section 5)
- [ ] Set yourself as admin: `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com'`
- [ ] Add your OpenAI API key to the `openai` LLM provider record via admin dashboard (or direct SQL)

### 8.4 Billing Production Setup
- [ ] Configure bank transfer details in admin settings (bank name, account name, BSB, account number)
- [ ] Create `payment-proofs` Supabase Storage bucket in production
- [ ] Set up Vercel Cron job for billing period expiry check (if using cron approach):
  - Create `vercel.json` with cron config: `{ "crons": [{ "path": "/api/cron/check-billing", "schedule": "0 0 * * *" }] }`
  - Add `CRON_SECRET` env var in Vercel
- [ ] Verify payment proof upload works with production Storage
- [ ] Test full payment flow: user uploads proof → admin approves → user plan upgrades

### 8.5 CI/CD Pipeline
- [ ] Add GitHub repository secrets (Settings → Secrets → Actions):
  - `SUPABASE_PROJECT_REF` — from Supabase dashboard → Settings → General
  - `SUPABASE_ACCESS_TOKEN` — from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
- [ ] Create `.github/workflows/deploy.yml`:
  - Trigger: push to `main`
  - Jobs:
    1. `checks`: checkout → setup node 20 → `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm test`
    2. `migrate` (needs: checks): checkout → setup supabase CLI → `supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}` → `supabase db push` (env: `SUPABASE_ACCESS_TOKEN`)
  - Vercel auto-deploys from `main` (no separate deploy step needed)

### 8.6 Post-Deployment Verification
- [ ] Register a test user account
- [ ] Create a chatbot with a test domain
- [ ] Embed widget on a test page → verify chat works
- [ ] Upload a test document → verify RAG works
- [ ] Create an enquiry form → verify form appears in chat → submission stored in DB
- [ ] Test webhook forwarding
- [ ] Test rate limiting (send 21 messages in 1 minute → 429 on 21st)
- [ ] Test domain verification (wrong origin → 403)
- [ ] Log in as admin → verify CRM dashboard, provider management

#### Phase 8 — Acceptance Criteria
- [ ] Production site is live at configured URL
- [ ] All features work end-to-end in production environment
- [ ] Widget works on external websites (test with a real domain)
- [ ] EFT payment proof upload + admin approval flow works in production
- [ ] CI/CD pipeline: push to main → tests run → migrations applied → Vercel deploys
- [ ] No errors in Vercel function logs
- [ ] No errors in Supabase logs
- [ ] Rate limiting works in production
- [ ] Admin can manage users, providers, and analytics

---

## Quick Reference: File ↔ Phase Map

| File | Phase | Purpose |
|---|---|---|
| `supabase/migrations/001_initial_schema.sql` | 1.1 | Full database schema |
| `src/lib/supabase/client.ts` | 0.8 | Browser Supabase client |
| `src/lib/supabase/server.ts` | 0.8 | Server Supabase client |
| `src/lib/supabase/admin.ts` | 0.8 | Service role client |
| `src/lib/openai.ts` | 0.8 | OpenAI embeddings client |
| `src/lib/ratelimit.ts` | 0.8 | Upstash rate limiter |
| `src/lib/rag.ts` | 2.3 | Chunking + embedding + search |
| `src/lib/ai/provider.ts` | 3.1 | Multi-LLM factory |
| `src/lib/ai/tools.ts` | 3.3 | AI SDK tools builder |
| `src/middleware.ts` | 1.3 | Auth + admin guard |
| `src/types/index.ts` | 0.7 | TypeScript interfaces |
| `src/app/api/chat/[chatbotId]/route.ts` | 1.7, 2.5, 3.2 | Public chat endpoint |
| `src/app/api/widget/[chatbotId].js/route.ts` | 1.8, 3.9 | Widget script |
| `src/app/api/chatbots/route.ts` | 1.5 | Chatbot CRUD |
| `src/app/api/chatbots/[id]/documents/route.ts` | 2.2 | Document upload + processing |
| `src/app/api/chatbots/[id]/enquiry-forms/route.ts` | 3.7 | Enquiry form CRUD |
| `src/app/api/enquiries/route.ts` | 3.8 | Enquiries listing |
| `src/app/api/admin/users/route.ts` | 5.2 | Admin CRM |
| `src/app/api/admin/providers/route.ts` | 3.4 | LLM provider management |
| `src/lib/billing.ts` | 7.1 | Plan pricing + limits constants |
| `src/app/api/payments/route.ts` | 7.2 | User payment submission + history |
| `src/app/api/admin/payments/route.ts` | 7.3 | Admin payment review list |
| `src/app/api/admin/payments/[id]/route.ts` | 7.3 | Admin approve/reject payment |
| `src/app/(dashboard)/billing/page.tsx` | 7.6 | User billing + plan upgrade page |
| `src/app/(admin)/admin/payments/page.tsx` | 7.7 | Admin payment review page |
| `vitest.config.ts` | 0.6 | Test configuration |
| `src/test/setup.ts` | 0.6 | Test setup |
| `.github/workflows/deploy.yml` | 8.5 | CI/CD pipeline |

---

*Generated from: [[ai-chatbot-saas-plan]] · Checklist v2 · 2026-03-28 — Replaced Stripe with EFT (manual bank transfer + admin approval)*
