# AI Chatbot SaaS — Product & Strategy Analysis

> **Purpose:** a discussion document. It states what has actually been built (read from the code, not the plan docs), what problem it solves, where it sits against Chatbase, and what integrations are worth building — in priority order.
>
> **Date:** 10 September 2026
> **Codebase reviewed at:** commit `9246482` (main, clean)

---

## Part 1 — What you have actually built

I read the schema, the route handlers, and the widget generator rather than the plan docs. Here is the honest inventory.

### 1.1 The architecture in one paragraph

A multi-tenant Next.js 16 app on Supabase. A subscriber signs up, creates a chatbot record, configures it across 11 tabs, and copies a one-line `<script>` tag. That tag hits `GET /api/widget/[chatbotId]`, which **generates a self-contained vanilla-JS widget as a string** with the bot's colour, position, name, welcome message and quick actions baked in. The widget POSTs to `/api/chat/[chatbotId]`, which is the single brain of the product: rate limit → load chatbot → validate origin domain → check owner's plan/usage/billing → create-or-resume conversation → persist the user message → resolve the LLM → build a layered system prompt → RAG lookup → assemble tools → `streamText` → stream plain text back, then append custom `__FORM__…__ENDFORM__` and `__APIDATA__…__ENDAPIDATA__` markers that only the widget knows how to parse into rendered forms and data cards.

### 1.2 What is genuinely strong

| Capability | Where | Why it matters |
|---|---|---|
| **Layered system prompt assembly** | `src/app/api/chat/[chatbotId]/route.ts` | Personality → skills → RAG context → enquiry-form rules → API-connection rules, composed per request. This is the correct pattern and most competitors' "custom instructions" box is less capable. |
| **Generic API connections as AI tools** | `006_api_connections.sql`, `src/lib/ai/tools.ts` | A subscriber can point the bot at any HTTP endpoint with `{param}` URL interpolation, header auth, a body template, a dot-notation `response_path`, and a timeout — and the bot gets a callable tool. **This is a no-code integration engine.** It is the most commercially valuable thing in the repo. |
| **AI-generated forms rendered in-chat** | `tools.ts` → `fieldToZod`, stream markers | The model calls a tool, the tool emits a form definition, the widget renders a real form with validation and pre-filled fields. Far better conversion than asking a visitor to type their email into a chat bubble. |
| **Visual data cards** | `prepareCardData`, `__APIDATA__` markers | Live API results render as cards, not as a wall of text. Chatbase calls this feature "interactive widgets" and gates it behind $150/mo. |
| **Enquiry funnel / lead pipeline** | `007_enquiry_funnel.sql`, `src/lib/funnel.ts` | Stages, priority, deal value, next-action dates, tags, an activity/audit timeline, and tasks. **This is a small CRM, and it is your actual differentiator** — see §3.2. |
| **Multi-LLM with admin-managed keys** | `src/lib/ai/provider.ts` | OpenAI / Anthropic / Google behind one interface, per-chatbot override, admin enable/disable per provider. |
| **Real admin/reseller layer** | `src/app/(admin)/**` | User CRM, plan changes, suspend, impersonation, analytics, platform settings, payment approval. Most self-serve SaaS starters have none of this. It means you can operate this as an **agency-run platform**, not just self-serve. |
| **Manual EFT billing** | `src/lib/billing.ts`, `/api/payments/**` | Bank transfer with proof upload and admin approval, AUD formatting, BSB fields. Unusual — and exactly right for Australian SMBs who will not put a card into a US SaaS. |
| **Test coverage** | 194+ tests, ~92% statements | Genuinely unusual for a prototype at this stage. |

### 1.3 What is missing — and which gaps are commercially expensive

Ordered by how much revenue each one costs you.

| # | Gap | Verified in code | Commercial impact |
|---|---|---|---|
| **1** | **No website crawler / URL knowledge source.** Knowledge base is file-upload only (PDF/TXT/DOCX). No `crawl`, `sitemap`, or `scrape` anywhere in `src/`. | `knowledge_documents` has `file_name`/`file_url`/`mime_type` only | **Severe.** Chatbase's entire onboarding is "paste your website URL, get a bot in 60 seconds." You are asking a plumber to find and upload PDFs. This is the single biggest conversion killer. |
| **2** | **No email or Slack notification on a new enquiry.** No `resend`/`sendgrid`/`smtp2go`/`nodemailer` in the codebase. Only a per-form optional `webhook_url`. | `grep` → none | **Severe.** A lead arrives; the business owner never learns. Your CRM/funnel feature is worthless if nobody opens the dashboard. This is a ~1-day build with the highest ROI in the repo. |
| **3** | **No human handoff / live-agent takeover.** No `handoff`/`takeover`/`live agent` anywhere. | `grep` → none | **High.** 75% of customers want a human for complex or emotional issues. Without an escape hatch, a bad bot answer becomes a lost customer and a support complaint aimed at you. |
| **4** | **No team seats.** No `organization`/`seats`/`invite`/`team_member`. One `profiles` row = one login. | `grep` → none | **High.** Blocks any business with a receptionist plus an owner, and blocks agency-managed accounts. Also caps your ARPU — seats are the easiest upsell in SaaS. |
| **5** | **Chat pipeline is welded to the web widget.** `conversations` has no `channel` column; the response contract is custom text markers the widget parses; identity is a random `visitor_…` string. | `001_initial_schema.sql`, chat route stream | **Blocking for Facebook/Instagram/WhatsApp.** You cannot add a channel without the refactor in §5.1. |
| **6** | **Pricing ignores model cost.** `PLAN_LIMITS` counts raw messages. The Model tab is still live (`ModelSelector` renders), and an empty `chatbot.api_key` falls through to the shared `platform_api_key`. | `billing.ts`, `provider.ts`, chatbots `[id]/page.tsx:198` | **Margin risk — see §6.** A subscriber switching to a frontier model turns a profitable account into a loss-making one, on your API key. |
| **7** | **`message_count` is a read-modify-write.** `update({ message_count: profile.message_count + 1 })` after each turn. | chat route `onFinish` | Concurrent conversations lose increments → you undercount and undercharge. Should be an atomic SQL increment or an RPC. |
| **8** | **One message = up to 3 LLM calls.** `stopWhen: stepCountIs(3)` for tool loops, but usage increments by exactly 1. | chat route | Tool-heavy bots cost you up to 3× what you meter. |
| **9** | **Domain validation is weak.** Exact string match after stripping scheme/slash, **skipped entirely if `Origin` is absent**, and CORS is `Access-Control-Allow-Origin: *`. | chat route | `app.acme.com` fails when `domain` is `acme.com`; and any server-side client (curl, script) sends no `Origin` and bypasses the gate entirely — someone else's site or a bot farm can burn your subscriber's quota and your API credits. Needs: multi-domain allowlist, subdomain matching, and a decision on no-`Origin` requests. |
| **10** | **API keys stored in plaintext.** `llm_providers.platform_api_key TEXT`, `chatbots.api_key TEXT`. `LLM_USAGE_EXPLAINED.md:13` claims they are "stored encrypted" — they are not; they are only *masked in API responses*. | `001_initial_schema.sql` | Fix the doc, then encrypt at rest (pgsodium/Vault) or move keys out of the tenant DB. |
| **11** | **Rate limiter fails open.** No Upstash config → every request allowed. | `src/lib/ratelimit.ts` | Correct for local dev, dangerous in prod. Add a prod-only startup assertion. |
| **12** | **No subscriber-facing analytics.** Admin gets recharts dashboards; the subscriber gets 4 stat cards. | `(admin)/admin/analytics` vs `(dashboard)/dashboard` | Medium. "What did people ask that my bot couldn't answer?" is the #1 retention feature in this category — it's the report that makes someone log in weekly. |
| **13** | No CSAT / thumbs feedback, no conversation tagging, no voice channel, no per-chatbot usage attribution. | — | Later-stage. Noted for completeness. |
| **14** | **Doc drift.** `LLM_USAGE_EXPLAINED.md` says "we removed the Model tab" and "users cannot change these." Both are false in current code. | tabs list line 118 | Fix before this doc misleads a future decision. |

---

## Part 2 — What problem are we actually solving?

### 2.1 The problem as most people state it (and why that framing is weak)

> "Businesses can't answer customer questions 24/7."

This is true but it is a **commodity framing**. Every one of the ~200 chatbot SaaS products says it, ChatGPT can arguably do it for free, and it prices you into a race to the bottom. If you pitch this, you compete on price with Chatbase, Intercom Fin, Tidio, Voiceflow and a Wix plugin — and you lose, because they have distribution and you don't.

### 2.2 The problem worth solving

There are three real, specific, painful problems. Only the third is defensible.

**Problem A — Attention decays in minutes, and SMBs answer in days.**
A visitor is on a website *right now* with an intent. If they fill a contact form, the typical Australian SMB replies the next business day — often later. By then the visitor has contacted two competitors. The problem is not "no answers"; it is **the gap between intent and response**. Businesses lose money in that gap, and the loss is invisible to them, which is why they under-invest in fixing it.

**Problem B — Static websites can't answer specific questions.**
A website says "we service the Hunter region" and "we offer plumbing." A visitor wants to know: *"Do you do emergency hot water in Maitland on a Sunday, and roughly what does it cost?"* No static page answers that. So the visitor bounces, or calls — and phone is expensive and unanswered when the tradie is under a sink.

**Problem C — The unqualified-lead problem. ← this is the one.**
The genuinely painful, expensive, under-solved problem is not that leads don't arrive. It's that leads arrive as **"Hi, can you call me? — Dave"** with no context. Someone then has to call Dave, discover he's out of the service area or wants something you don't sell, and that's 15 minutes gone. Multiply by every enquiry.

Framed properly, your product is:

> **A conversational front desk that captures intent the moment it appears, qualifies it against the business's own rules and live systems, and delivers a structured, ranked, actionable lead into a pipeline the business already works out of — instead of an unqualified email.**

That framing is worth noticing because it is **not what Chatbase sells** (see §3), and because your codebase already contains the two halves that make it true: the API-connection tool engine (qualify against live data) and the enquiry funnel (deliver into a pipeline).

### 2.3 The strategic tailwind nobody is pricing in yet

AI answer engines — ChatGPT, Perplexity, Gemini, AI Overviews — are absorbing the top of the funnel. Informational search traffic to SMB websites is falling and will keep falling. The consequence is counter-intuitive and important:

**Every remaining website visitor is worth dramatically more than they were three years ago.** Fewer, later-stage, higher-intent visitors. Conversion-rate optimisation on that shrinking traffic goes from "nice" to "existential."

That is the strongest possible argument for your product, and it is an argument about *revenue*, not about *cost savings*. It is a much better sales conversation with an SMB owner than "save on support staff" — because a plumber has no support staff to save on.

---

## Part 3 — Advantages of the AI SaaS chatbot model

### 3.1 Advantages that are real

**For the business (your subscriber)**
- **Response latency goes from hours to zero**, at the exact moment of intent (Problem A).
- **Answers are specific**, drawn from their own documents and live systems (Problem B) — not a generic FAQ tree.
- **Leads arrive pre-qualified and structured** — the funnel gives them stage, priority, value and next action (Problem C).
- **Every conversation is a research artefact.** The transcript log is an unfiltered record of what customers actually want, in their own words. Most SMBs have never had this. It's worth more than the chatbot.
- **No maintenance.** Update a PDF, the bot updates. Compare to a decision-tree bot, where every new question means an afternoon in a flowchart builder.
- **Extends the business's hours without extending its payroll.**

**For you (the platform operator)**
- **Recurring revenue on near-zero marginal cost** — an idle chatbot costs you a database row.
- **A one-line `<script>` tag is the lowest-friction install in software.** No plugin, no DNS, no rebuild. Works on WordPress, Wix, Squarespace, Shopify, a hand-written HTML page.
- **Multi-tenancy compounds.** Every improvement to the chat pipeline improves all subscribers at once.
- **Very high switching cost once the funnel is used.** A subscriber can move a chatbot in an afternoon. They cannot move six months of lead pipeline, activity history and tasks. **Your CRM is your retention.** This is worth understanding clearly — it's the difference between 5% and 2% monthly churn.
- **The API-connection engine turns every client integration into reusable product.** You build a Rezdy connection for one tour operator; you now have a Rezdy template for every tour operator.
- **Natural agency upsell path.** You already have impersonation and an admin CRM. "We build and manage your bot" at $200–500/mo setup + retainer is a much better business than $29/mo self-serve.

### 3.2 The honest counter-case

Say these out loud now, because a prospect or investor will.

- **The core is commoditising fast.** "RAG over documents + a widget" is a weekend build in 2026. There is no moat in the chat loop itself. The moat is the funnel, the integrations, and the client relationships.
- **The market is brutally crowded.** Chatbase alone claims 10,000+ brands. Intercom, Zendesk, HubSpot and Tidio all ship this as a feature of a product businesses already pay for.
- **Wrong answers are a liability, not just a bug.** A bot that quotes the wrong price or promises a Sunday callout creates a real commercial dispute. Your subscriber will blame you. You currently have **no human handoff and no confidence threshold** — that's gap #3, and it is a legal/reputational exposure as much as a feature gap.
- **You take on LLM cost risk.** With a shared platform key and message-count-based plans, your COGS is a function of your subscribers' behaviour, not your pricing. See §6.
- **SMB churn is structurally high.** Small businesses close, change hands, and cancel. Assume 3–5% monthly churn on self-serve; this is why the agency-managed tier matters.

---

## Part 4 — Is chatting now the natural user response, because of ChatGPT?

Short answer: **the interface is normalised. Trust in the bot is not. Those two facts should drive your product design in opposite directions, and getting that right is most of the UX work.**

### 4.1 What the data says

| Finding | Figure | Source |
|---|---|---|
| Prefer messaging over calling for support | **56%** | [chatbot.com](https://www.chatbot.com/blog/chatbot-statistics/) |
| Phone as preferred channel, declining | 63% → **60%** | [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics/) |
| Americans who say they prefer human service over AI | **79%** | [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics/) |
| …but who prefer a bot **when they want an immediate answer** | **51%** | [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics/) |
| Prefer a human for complex / sensitive / emotional issues | **75%** | [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics/) |
| Routine questions a bot can handle | up to **80%** | [Botpress](https://botpress.com/blog/key-chatbot-statistics) |
| Enterprise apps with task-specific AI agents by 2026 | **40%** (from <5% in 2025) | [Zendesk](https://www.zendesk.com/blog/ai/productivity/ai-customer-service-statistics/) |
| Contact centres using some AI | **88%** (only 25% fully integrated) | [Master of Code](https://masterofcode.com/blog/ai-in-customer-service-statistics) |

### 4.2 Reading those numbers correctly

The 79%-prefer-humans figure and the 51%-prefer-bots figure look contradictory. They aren't. They measure different things:

- **79% is an identity statement.** Asked abstractly, people say they want a human. It reflects a decade of being trapped in bad IVR menus and useless decision-tree bots.
- **51% is a behavioural statement.** In the moment, when they want an answer *now*, half of people choose the bot.

**The gap between those two numbers is where your product lives.** People will use the bot; they just won't admit to preferring it. So optimise for the behaviour, not the stated preference. Don't try to win an argument about whether people "like" chatbots.

### 4.3 What ChatGPT actually changed

Three things, and only the first is the one people usually name.

1. **Input behaviour.** Users now type full natural-language sentences instead of hunting for a button. This **kills the decision-tree chatbot category** and is pure tailwind for you. Your product is on the right side of this.
2. **Expectation of competence.** Users expect the bot to handle a topic change, remember what they said four turns ago, and stream a response. A bot that replies "I'm sorry, I didn't understand that" now reads as *broken* rather than *limited*. Your bar is much higher than a 2021 chatbot's.
3. **Expectation of agency — the underrated one.** Post-ChatGPT users expect the assistant to *do things*, not just talk. "Can you book that?" is now a reasonable question to ask a chat box. **A bot that only answers questions feels obsolete.** This is precisely why your API-connection engine matters more than your RAG.

### 4.4 The design rules that follow

- **Never pretend to be human.** It backfires the moment it's discovered, and the 79% figure means people are actively watching for it. Label it: "AI assistant — I can also put you through to the team."
- **Make escalation visible from turn one**, not buried after three failures. Paradoxically, a visible human escape hatch *increases* bot usage — it removes the fear of being trapped, which is what the 79% is really about.
- **Lead with actions, not answers.** Booking, quoting, checking an order, submitting a qualified enquiry. Answers are table stakes; actions are why they'll pay.
- **Fail loudly and hand off.** "I don't have that — let me take your details and get Sarah to call you" is a *successful* conversation. Silence dressed as an answer is the failure mode that loses your subscriber their customer.
- **Keep quick-action pills.** You already render these when `messages.length <= 1`. They solve the blank-canvas problem: users who don't know what to ask.

---

## Part 5 — Integrations: the full landscape, in priority order

### 5.1 The refactor you need first (before any channel work)

Right now `POST /api/chat/[chatbotId]` *is* the product, and it assumes the web widget:
- identity is a random `visitor_…` string generated client-side
- the response is `text/plain` with bespoke `__FORM__` / `__APIDATA__` markers only the widget parses
- `conversations` has no channel or external-thread column
- continuity rides on the `X-Conversation-Id` header

**None of that survives contact with Messenger.** Meta sends you a webhook with a page-scoped user ID and expects a POST back to the Send API within a window — there is no stream, no header, no marker parsing.

**Do this refactor once, and every channel becomes a small adapter:**

```
1. Extract the pipeline into a channel-agnostic core:

   src/lib/chat/run-turn.ts
     runChatTurn({ chatbotId, channel, externalUserId, externalThreadId, text })
       → { text, forms[], cards[], conversationId, escalate }

   Everything currently in the route handler between "fetch chatbot" and
   "onFinish" moves here. The route handler becomes one of several callers.

2. Add channel columns:

   ALTER TABLE conversations
     ADD COLUMN channel TEXT NOT NULL DEFAULT 'web'
       CHECK (channel IN ('web','messenger','instagram','whatsapp','sms','email','slack','telegram')),
     ADD COLUMN external_thread_id TEXT,
     ADD COLUMN external_user_id   TEXT;
   CREATE UNIQUE INDEX ... ON conversations (chatbot_id, channel, external_thread_id)
     WHERE external_thread_id IS NOT NULL;

   New table: chatbot_channels (chatbot_id, type, credentials JSONB, is_enabled)
     — one row per connected page/number/account.

3. Return structured output, render per channel:

   Web       → the current stream + markers (unchanged, no regression)
   Messenger → text + quick_replies + generic template carousel
   WhatsApp  → text + interactive list/button messages
   SMS/email → plain text, forms degrade to a link to a hosted form page

   i.e. a `renderers/` folder keyed by channel. The core never knows about
   markers; the web renderer owns them.

4. Async by default. Meta/WhatsApp webhooks must ACK in seconds — process
   the turn after the ACK. You already use `after()` from next/server for
   document processing; same pattern, or move to a queue.
```

This is roughly a week of work and it is the gate on everything in §5.3. **Do not build the Messenger integration first and refactor later** — you will build it twice.

### 5.2 Tier 1 — Build these next (highest ROI, no channel work needed)

| # | Integration | Effort | Why it's first |
|---|---|---|---|
| 1 | **Website crawler + sitemap ingest** | 2–3 d | Closes gap #1. Turns onboarding from "find your PDFs" into "paste your URL." Use your existing `firecrawl` or `web-scraper` MCP-backed service, or Firecrawl's API directly: crawl → `chunkText` → `embedText`. Add a nightly re-crawl (Chatbase gates "auto-retrain" at $150/mo). |
| 2 | **Email notifications** | 1 d | Closes gap #2. You already have an SMTP2GO MCP server — so you have the account. New enquiry → email the owner. New enquiry → email the *visitor* a confirmation. Daily digest of unanswered questions. **Highest ROI single day of work in the repo.** |
| 3 | **Slack / Teams notification** | 1 d | Same trigger, different sink. Incoming webhook is trivial. Teams matters more than Slack for Australian SMBs on Microsoft 365. |
| 4 | **Zapier / Make / n8n** | 2 d | You already fire per-form webhooks. Formalise it: platform-level outbound events (`enquiry.created`, `conversation.escalated`, `stage.changed`) + a Zapier app. **This is the cheapest way to claim "5,000+ integrations"** without building any of them, and it deflects the #1 sales objection ("does it work with X?"). |
| 5 | **Calendar booking (Cal.com → Google Calendar)** | 3–4 d | The #1 action SMBs want. Cal.com first: open API, self-hostable, no OAuth review. Then Google Calendar for direct availability. Render slots as cards — your `__APIDATA__` renderer already does this. |
| 6 | **Q&A pairs as a knowledge source** | 1 d | Lets a subscriber correct a wrong answer directly ("when asked X, say Y") instead of editing a PDF. Cheap, and it is how they will *fix* the bot — which is how you keep them. |
| 7 | **Human handoff** | 3–5 d | Closes gap #3. MVP does not need a live chat console: bot detects intent/failure → captures details → notifies via email+Slack → tells the visitor when to expect a reply. A real agent console can come later. |

### 5.3 Tier 2 — Channels (needs §5.1 first)

| Channel | Effort | Notes |
|---|---|---|
| **Facebook Messenger** | 1–2 wk | See §5.4. Requires Meta App Review for `pages_messaging`. |
| **Instagram DM** | +3–5 d after Messenger | Same webhook infra, different permission (`instagram_business_manage_messages`) and a separate App Review. **Higher SMB demand than Messenger in AU** — retail, beauty, hospitality, fitness live in Instagram DMs. |
| **WhatsApp Business Cloud API** | 2–3 wk | Highest effort, highest commercial value. Per-message pricing, template approval, phone-number provisioning, Business Verification. See §5.4. |
| **SMS (Twilio)** | 3–5 d | Easiest non-web channel. No app review, no template approval, no 24-hour window. Good place to prove the channel abstraction works before tackling Meta. |
| **Email-as-a-channel** | 1 wk | Inbound `support@` → bot drafts or auto-replies. Chatbase leads with this. Underrated: it's where the actual support volume is. |
| **Telegram** | 1–2 d | Trivially easy bot API, no review. Low AU demand, but a genuinely cheap demo win. |
| **Voice / telephony** | 4+ wk | Chatbase gates this at $150/mo. Twilio Voice + a realtime speech model, or Vapi/Retell to skip the plumbing. **Do not build this before you have 50 paying subscribers.** |

### 5.4 How to actually integrate Facebook / Instagram / WhatsApp

This is the part most people underestimate. **The engineering is the easy half; the Meta approval process is the hard half, and it's mostly calendar time, not work.** Plan for 4–8 weeks of elapsed review time.

#### One-time platform setup (you do this once, ever)

1. **Meta Business Portfolio** + a **Meta App** (type: Business) at developers.facebook.com.
2. **Business Verification** — Meta verifies *Jezweb* as a legal entity: ABN, business documents, a verifiable business phone and domain. Takes days to weeks. Start this immediately; everything else queues behind it.
3. **Add products** to the app: Messenger, Instagram, WhatsApp.
4. **App Review** for Advanced Access on each permission you need. This is the real gate:
   - Messenger: `pages_messaging`, `pages_manage_metadata`, `pages_show_list`
   - Instagram: `instagram_business_manage_messages`, `instagram_basic`
   - WhatsApp: `whatsapp_business_messaging`, `whatsapp_business_management`
   Each submission needs a **screencast** showing the full flow, a written use-case justification, and test credentials. Expect at least one rejection — budget for a resubmission.
5. **Privacy policy URL, Terms URL, Data Deletion callback** — mandatory, and reviewers actually check them. You need a real data-deletion endpoint, not a page.
6. **App Secret verification** — verify `X-Hub-Signature-256` on every webhook. Meta will reject apps that don't.

#### The per-subscriber flow (what you build)

```
Subscriber clicks "Connect Facebook Page"
  → Facebook Login dialog, scopes: pages_show_list, pages_messaging
  → exchange short-lived user token → long-lived token
  → GET /me/accounts → list their Pages → subscriber picks one
  → store the PAGE access token (never the user token) in chatbot_channels.credentials
  → POST /{page-id}/subscribed_apps to subscribe your app to that Page's webhooks
  → for Instagram: the IG Professional account must be linked to that Page;
    read it via /{page-id}?fields=instagram_business_account
```

```
Inbound message
  → POST /api/channels/meta/webhook
  → verify X-Hub-Signature-256           (reject if invalid)
  → ACK 200 IMMEDIATELY                  (Meta retries and eventually disables slow endpoints)
  → process async:
      resolve page_id → chatbot_channels → chatbot
      resolve sender.id (page-scoped, PSID) → conversations
        (channel='messenger', external_user_id=PSID, external_thread_id=PSID)
      runChatTurn(...)
      render for Messenger (text + up to 13 quick_replies, or a generic template)
      POST /{page-id}/messages with the Page token
```

#### The policy constraints — design for these, you cannot engineer around them

- **The 24-hour messaging window.** You may only send freely within 24 hours of the user's last message. After that: template messages (WhatsApp) or a tag/`HUMAN_AGENT` message (Messenger). [Meta's Messenger/IG policy was last updated 6 April 2026](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy).
- **The 7-day human-agent extension** (Messenger/IG) applies only when a *human* is handling the thread — not your bot.
- **One private reply per comment** on Instagram/Facebook posts. Not one per user, per *comment*.
- **Crossing these produces error codes; repeat violations get the account blocked.** [Detail here](https://www.keyapi.ai/blog/instagram-messaging-api-policy/).
- **Instagram needs Advanced Access via App Review** — there is no shortcut. [Approval guide](https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/).

Practical consequence: **your funnel's "next action" and follow-up features must be window-aware.** A "follow up in 3 days" task cannot send a free-form Messenger message. Build the window check into the outbound path from day one, or you will ship a feature that silently fails in production.

#### WhatsApp pricing — this changes your business model

WhatsApp moved to **per-message pricing on 1 July 2025**. Platform access is free; each template message is charged by recipient country and category:

- **Marketing:** ~$0.0109 (Turkey) → ~$0.1597 (Netherlands) per message as of 1 April 2026
- **Utility:** ~$0.0008 (Colombia) → ~$0.0550 (Germany)
- **Authentication:** ~$0.0014 (India) → $0.05+ (parts of Europe)
- **Service messages** inside the 24-hour window are free — **but from 1 October 2026 service and utility messages inside the window start being charged again, with no volume tier.**

Sources: [respond.io](https://respond.io/blog/whatsapp-business-api-pricing), [Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026), [EngageLab](https://www.engagelab.com/blog/whatsapp-business-api-pricing).

**Implication:** WhatsApp cannot sit inside a flat $29/mo plan. It needs either pass-through billing (you meter and on-charge, with a margin) or a per-channel add-on fee. Get this right *before* you sell WhatsApp to anyone. Note the 1 Oct 2026 change is three weeks away — model it now.

### 5.5 Tier 3 — Business systems (the API-connection engine's real payload)

Your generic API-connection feature means many of these are **configuration templates, not code**. That is a large strategic advantage: ship a "connection library" of pre-filled templates and you get integration breadth without integration engineering.

**Knowledge sources**
Website crawl · sitemap · Notion · Google Drive/Docs · Confluence · Zendesk/Intercom help centre · YouTube transcripts · Q&A pairs · product feed (CSV/XML) · Google Business Profile (hours, address, reviews)

**CRM & sales**
HubSpot (free tier = huge SMB install base) · Pipedrive · Salesforce · Zoho · Airtable · Google Sheets (do not underestimate this — it's how SMBs actually keep data)

**Booking & scheduling**
Cal.com · Calendly · Google Calendar · Microsoft Bookings · Acuity · **Rezdy** (tours/activities — you already run an MCP for it) · ServiceM8 / Tradify / SimPRO (**AU trades — very strong Jezweb fit**)

**Commerce & payments**
Shopify · WooCommerce · BigCommerce · Stripe (order/subscription lookup) · **Xero** (invoice/quote status — you already have the MCP) · MYOB

**Support & ticketing**
Zendesk · Freshdesk · Help Scout · Intercom · Jira Service Management (you have the Atlassian MCP)

**Platform / CMS**
**WordPress plugin** (see below) · Shopify App Store listing · Wix App Market · Squarespace code injection · Webflow

**Automation & ops**
Zapier · Make · n8n · outbound webhooks (partially built) · Twilio (SMS + voice) · SMTP2GO (transactional email)

**Analytics**
GA4 events (`chat_opened`, `enquiry_submitted`) · Meta Pixel · PostHog · your own per-chatbot dashboard (gap #12)

**Forward-looking — worth a serious look**
- **Publish an MCP server per chatbot.** Let the subscriber's *own* Claude/ChatGPT query their knowledge base and API connections. You already build MCP servers as a house competency; nobody in this category offers it yet.
- **Generate `llms.txt` / an AI-agent-readable endpoint** for the subscriber's site. As AI agents start doing the browsing, the businesses that are machine-readable win. That is a sellable service on top of the chatbot.

### 5.6 Two distribution plays worth more than any single integration

1. **A WordPress plugin.** WordPress runs ~40% of the web and dominates Australian SMB sites. A plugin that installs the widget with a paste-in key, plus a "crawl this site" button that reads posts/pages directly from the WP REST API, is a **distribution channel**, not an integration — the plugin directory is free, permanent, search-indexed lead generation. You already run a `jezpress` MCP server, so the competency is in-house.
2. **A Shopify app.** Higher effort (app review, billing API) but the highest willingness-to-pay per install in SMB software, and product/order lookup is a natural fit for your API-connection engine.

---

### 5.7 How to actually integrate voice calls (ElevenLabs)

§5.3 rated voice "4+ wk, don't build before 50 subscribers." **The effort estimate was too pessimistic and the reasoning was slightly wrong.** ElevenLabs Agents sells you the genuinely hard parts — ASR, turn-taking, barge-in, telephony — so the *build* is ~2 weeks on top of §5.1, not 4+. What stays hard is operational: latency, concurrency, cost control, compliance. The "wait for 50 subscribers" advice stands, but for a commercial reason (§5.7.7), not an engineering one.

#### 5.7.1 Two products, not one

| | Voice on the website widget | **Phone calls (a real number)** |
|---|---|---|
| Value to an SMB | Low — novelty; they're already typing | **High — a missed call is a lost job** |
| Cost per minute | Identical | Identical |
| Pitch | "Talk to our website" | **"Never miss a call again"** |
| Verdict | Ship last, as a toggle | **This is the product** |

The scenario that sells itself, and it's the §2.2 problem applied to the phone: a tradie is under a sink at 3pm. The phone rings out. The caller rings the next result on Google. That job is gone. An AI that answers on ring four, establishes suburb / job type / urgency and drops a lead into the funnel with a value and a next action is worth hundreds a month to that business — and it uses the enquiry funnel you already built.

#### 5.7.2 The architecture fork

| | A: EL owns everything | **B: EL = ears + mouth, your engine = brain** ✅ | C: TTS/STT primitives only |
|---|---|---|---|
| EL provides | ASR, turn-taking, TTS, LLM, KB, tools | ASR, turn-taking, TTS, telephony | TTS + STT API calls |
| You provide | KB sync + webhook consumer | An OpenAI-compatible LLM endpoint | VAD, endpointing, barge-in, turn-taking |
| First call working | ~1 day | ~1 week | Months |
| Knowledge base | **Forked** — yours in pgvector, theirs in EL | **One** — existing pgvector RAG | One |
| Your AI SDK tools | Rebuilt as EL server tools | **Work unchanged** | Unchanged |
| Metering | Blind unless you parse webhooks | Engine sees every turn | Yours |
| Verdict | Fine for a demo. Wrong as a product. | **Build this** | No — turn-taking is their proprietary model |

Option A's failure mode deserves naming because it's seductive: a customer edits their knowledge base in your dashboard, and the voice bot keeps quoting last month's pricing — because that copy lives in ElevenLabs. You won't find that bug. Your customer's customer will.

**Option B is the same refactor as Meta.** §5.1's `runChatTurn()` just needs a third output encoding:

| Adapter | Mode | Wire format |
|---|---|---|
| Web widget | stream | Raw text + `__FORM__` / `__APIDATA__` markers |
| Meta webhook | complete | Buffered text → Messenger templates |
| **ElevenLabs** | **stream** | **OpenAI `chat.completion.chunk` SSE** |

One refactor, three channels. That materially improves the case for doing §5.1 sooner.

#### 5.7.3 The custom LLM contract

EL's "Bring your own LLM" expects an OpenAI-compatible `/v1/chat/completions` returning SSE (`Content-Type: text/event-stream`, chunks as `data: {json}\n\n`, terminated `data: [DONE]\n\n`). It sends `messages`, `model`, `temperature`, `max_tokens`, `stream`, a `tools` array when system tools are enabled, plus `elevenlabs_extra_body`. Auth is a secret set in the agent dashboard.

One endpoint per chatbot — which also solves tenancy without dynamic-variable gymnastics:

```ts
// src/app/api/voice/[chatbotId]/v1/chat/completions/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ chatbotId: string }> }) {
  const { chatbotId } = await params
  if (request.headers.get('authorization') !== `Bearer ${process.env.VOICE_LLM_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const { messages, tools: callControlTools } = await request.json()

  const result = await runChatTurn({
    chatbotId, messages,
    channel: 'voice',
    mode: 'stream',
    persist: false,      // post-call webhook does all bookkeeping — see 5.7.4
    callControlTools,    // end_call / transfer_to_number, passed through
  })

  return new Response(toOpenAISSE(result), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

function toOpenAISSE(result: StreamTextResult<never, never>): ReadableStream {
  const enc = new TextEncoder()
  const id = `chatcmpl-${crypto.randomUUID()}`, created = Math.floor(Date.now() / 1000)
  return new ReadableStream({
    async start(c) {
      const chunk = (delta: object, finish: string | null = null) =>
        c.enqueue(enc.encode(`data: ${JSON.stringify({
          id, created, object: 'chat.completion.chunk', model: 'voice-1',
          choices: [{ index: 0, delta, finish_reason: finish }],
        })}\n\n`))
      for await (const text of result.textStream) chunk({ content: text })
      chunk({}, 'stop')
      c.enqueue(enc.encode('data: [DONE]\n\n'))
      c.close()
    },
  })
}
```

`result.textStream` yields **only text** — your enquiry-form and API-connection tools resolve server-side inside the AI SDK loop and never touch the wire. Zero tool config duplicated into ElevenLabs.

**But two kinds of tools exist, and conflating them breaks the call:**

| | Your tools | Call-control tools |
|---|---|---|
| Examples | Enquiry forms, API connections, RAG | `end_call`, `transfer_to_number`, `language_detection` |
| Who executes | Your engine, via AI SDK | **Only EL can** — you cannot hang up a phone line |
| On the wire | Invisible | Must be emitted as an OpenAI `tool_calls` delta |

So pass EL's `tools` array through to `streamText` alongside your own, and forward matching calls back rather than executing them. `transfer_to_number` **is** the human-handoff gap from §1.3 — and voice is where its absence hurts most.

#### 5.7.4 Hot path vs cold path

**Persist nothing during the call.** EL sends the full `messages` array every turn, so the endpoint needs no conversation state. All bookkeeping happens in the post-call webhook, which gives you the transcript, duration and cost definitively.

```
HOT PATH (per turn, <500ms to first token)
  EL → /v1/chat/completions → cached config (Redis) → embed + match_chunks → streamText → SSE
  No writes. No rate-limit call. No profile lookup.

COLD PATH (once, after the call)
  EL → POST /api/voice/webhook (post_call_transcription)
     → verify `elevenlabs-signature` HMAC → persist conversation + messages
     → create enquiry from analysis.data_collection_results
     → decrement voice minutes from metadata.call_duration_secs → notify owner
```

#### 5.7.5 Latency is the whole game

On the web a thinking indicator buys you two seconds. **On a phone call, two seconds of silence sounds like the line dropped.** The current chat route does 5+ sequential round-trips before the first token: rate limit → fetch chatbot → fetch profile → insert user message → fetch forms + API connections → embedding → `match_chunks` → *finally* the LLM. That's dead air.

Fixes, by payoff: cache chatbot config + tool definitions in **Redis** at call start (kills 2 round-trips; you already pay for Upstash) · move persistence to the webhook (kills 2 more) · skip the per-IP rate limit here — EL is an authenticated caller, meter by minutes instead · parallelise embedding and config load · skip RAG on greeting turns · **use a fast model** (nobody wants a thoughtful pause on the phone) · `stopWhen: stepCountIs(2)`, not 3.

#### 5.7.6 Post-call webhook → the enquiry funnel

This is where voice pays off against what you've already built. The `post_call_transcription` payload carries `conversation_id`, `agent_id`, the full `transcript` (`{role, message, time_in_call_secs}`), `metadata.call_duration_secs`, `metadata.cost` (cents), and an `analysis` object with `transcript_summary`, `call_successful`, `evaluation_criteria_results` and **`data_collection_results`**.

`data_collection_results` is the one that matters: configure an extraction schema on the agent — name, phone, suburb, job type, urgency — and EL extracts it from the transcript post-call. **Map it straight onto `enquiries.data`** and you get a fully-populated funnel row at `pipeline_stage = 'new'` without ever showing a form. Generate that schema from the chatbot's existing `enquiry_forms.fields` so the customer configures fields once and gets them on web, Meta *and* phone.

Verify `elevenlabs-signature` before trusting any of it (`elevenlabs.webhooks.constructEvent(rawBody, sigHeader, secret)` checks signature + timestamp and parses). EL disables a webhook after 10 consecutive failures — return 200 fast and do the work in `after()`, the pattern already used in the documents route.

#### 5.7.7 Economics — voice breaks the pricing model outright

The metering flaw already flagged for text models isn't dangerous with voice, it's fatal.

| Component | Cost |
|---|---|
| EL Agents hosting | **$0.08/min**, flat across paid tiers |
| Burst (over concurrency limit) | **$0.16/min** |
| LLM tokens + telephony | Billed separately, yours |
| **Realistic all-in** | **$0.12 – $0.42 / min** |

Included minutes / concurrency by EL plan: Free 15 min / 4 · Starter 75 / 6 · Creator 275 / 10 · Pro 1,238 / 20 · Scale 3,738 / 30 · Business 12,375 / 40.

A 4-minute call at a mid-range $0.20/min costs **$0.80**. Against your $29 Pro plan:

| Scenario | Revenue | Cost | Result |
|---|---|---|---|
| 36 four-minute calls/mo | $29 (the whole plan) | ~$29 | **$0 margin, before any text usage** |
| 100 four-minute calls/mo | $29 | ~$80 | **−$51 / customer / month** |
| Metered as messages (~12 turns/call) | reads as 1,200 of 5,000 credits | ~$80 | **Meter says 24% used while you lose money** |

Three non-negotiables:

1. **Meter in minutes, never messages.** The webhook hands you `call_duration_secs` and `cost`; decrement from those and store the real cost per call.
2. **Sell voice as a paid add-on, never bundled.** ~3× cost — e.g. *300 minutes for $199/mo, then $0.75/min* — still trivially justified against one recovered job.
3. **Hard-stop at the limit** → voicemail or human. An unbounded meter on a $0.20/min resource is a five-figure surprise waiting to happen.

**And concurrency is a shared multi-tenant resource.** Your EL plan's limit (20 concurrent on Pro) is for the *entire platform*, not per customer. One busy tenant blocks everyone else's calls — and exceeding the limit doesn't error, it silently **doubles the rate** to $0.16/min. Track live concurrency in Redis, cap per chatbot, alert on burst minutes.

Schema this needs: `voice_minutes_used` / `voice_minutes_limit` on `profiles`, a `voice_calls` ledger (EL conversation id, direction, duration, provider + LLM cost, summary, linked enquiry), `'voice'` added to the `conversations.channel` CHECK, and `elevenlabs_agent_id` / `phone_number` / `voice_id` / `first_message` on the `channel_connections` table from §5.4. You'll also need to provision an EL agent per chatbot via their API when a customer enables voice.

#### 5.7.8 Australian compliance — get advice before shipping

Not legal advice; these are the areas that need it. **AI disclosure** in the agent's `first_message` — the §4 data says people escalate less when they aren't being deceived. **Call-recording consent** varies by state and some are all-party. **Outbound**: a callback to someone who just submitted an enquiry form is solicited and sits comfortably; cold outbound engages the Do Not Call Register Act and is a different proposition — don't let the feature drift there (§7.3 already rules out campaign tooling for the same reason). **Privacy Act**: transcripts are personal information; give customers a retention setting (EL's payload includes `deletion_settings`). **Define an escalation path** — an AI must never be the only thing between a distressed caller and a human.

#### 5.7.9 The two features actually worth building

Everything above is plumbing. These are what a trades or clinic customer pays for:

1. **Missed-call rescue.** Twilio forwards to the AI on no-answer / after-hours / busy. AI qualifies; the webhook creates a funnel enquiry and SMSes the owner: *"Missed call 0412… — burst pipe in Mayfield, urgent, wants a callback before 5pm."* Highest-value use of voice you can ship, and it requires **no change to how the business currently operates** — which is why it sells.
2. **Speed-to-lead callback.** Web enquiry lands → within 60 seconds the AI rings the lead back to qualify and book. The sharpest possible expression of the §2.2 pitch, uses EL's outbound API plus the `enquiries` table you have, and none of your local competitors are doing it.

#### 5.7.10 Build order

| Phase | Scope | Effort |
|---|---|---|
| 0 | `runChatTurn()` extraction — **shared with Meta (§5.1)** | 2–3 d |
| 1 | Custom LLM endpoint + SSE encoder; test in EL's playground | 2–3 d |
| 2 | Latency: Redis config cache, no hot-path writes, fast model, `stepCountIs(2)` | 3–4 d |
| 3 | Post-call webhook: signature verify, persist, `data_collection_results` → enquiry, minute metering | ~1 wk |
| 4 | Twilio number import, inbound routing, agent auto-provisioning, voice settings tab | ~1 wk |
| 5 | Missed-call rescue + owner SMS | 2–3 d |
| 6 | Concurrency admission control, burst alerting, hard-stop | 2–3 d |
| 7 | Outbound speed-to-lead callback | ~1 wk |
| Later | Voice in the website widget (`<elevenlabs-convai>` or the React SDK) | 2 d |

**~5 weeks to a production phone product**, of which Phase 0 is shared with Meta. Still after the crawler, notifications and handoff — those are cheap, serve every customer, and voice depends on handoff anyway.

## Part 6 — Chatbase: how you actually compare

### 6.1 Their positioning

Chatbase now positions as **"the leading AI agent for CX"** — customer experience, not "make a chatbot." Support agent, sales agent, product-guidance agent across live chat, email, phone and Slack. 10,000+ brands, G2 4.8, awards for Easiest Setup. Named features: Procedures (plain-language workflows with actions), interactive widgets, a shared AI+human helpdesk, "Backstage" sentiment/issue analytics, and a model playground spanning Claude, Gemini, GPT-5.x, DeepSeek, Grok and Kimi.

### 6.2 Their pricing vs yours

| | Chatbase | You |
|---|---|---|
| Free | $0 — 50 credits/mo, 1 agent, **agents deleted after 14 days idle** | $0 — 100 messages, 1 bot, no deletion |
| Entry paid | **Hobby $40/mo** ($32 yearly) — 700 credits, 2 seats | **Pro $29/mo** — 5,000 messages, 5 bots, 1 seat |
| Mid | **Standard $150/mo** ($120 yearly) — 4,000 credits, 3 seats, +helpdesk, voice, telephony, outbound campaigns, API access, auto-retrain, Stripe/Zendesk/Salesforce | — |
| High | **Pro $500/mo** ($400 yearly) — 15,000 credits, 5 seats, advanced analytics | **Enterprise $99/mo** — 50,000 messages, 20 bots |
| Enterprise | Custom — SSO, white-label, audit logs, SLA, HIPAA, zero retention | — |
| Add-ons | $40 / 1,000 credits · $25 per extra agent · **$99/mo to remove branding** | — |

**Read that table again, because it's the most important thing in this document.**

- Chatbase charges **$150 for 4,000 messages.** You charge **$29 for 5,000.** You are roughly **20× cheaper per message.**
- Chatbase's *cheapest paid plan* is $40 for **700** messages. Your free tier is 100; your $29 tier is 5,000.
- Chatbase charges **$99/mo just to remove their logo** — more than three times your entire Enterprise plan.

Two possible conclusions, and you need to pick one deliberately:

**(a) Your pricing is a mistake.** You've anchored at Australian-web-hosting prices for a product whose market rate is 5–15× higher. You will attract the most price-sensitive, highest-churn, highest-support-burden customers, and you'll have no margin to fund the gaps in §1.3. Note also that "50,000 messages for $99" is a number you cannot honour on a frontier model (see §6.4).

**(b) Price is your deliberate wedge** into a segment Chatbase doesn't want — Australian SMBs who won't pay USD $150/mo, sold through an agency relationship. Defensible, but then **you must never compete on features** with Chatbase, and you must make the money on setup fees and retainers, not the subscription.

My read: **(b) is the right strategy but your current numbers are still too low even for it.** $29 → $49–79/mo for the mid tier, an entry tier at $19–29 with a real message cap, and setup fees of $500–2,000 is a business. $29/mo self-serve against 3–5% monthly churn is not.

### 6.3 Where you actually win

| You win on | Because |
|---|---|
| **Lead pipeline / CRM** | Chatbase is a **support** product; its analytics summarise *issues and sentiment*. You built stages, deal value, priority, tasks, activity timelines. **Nobody in this price band ships a funnel.** For an SMB whose problem is Problem C (§2.2), you are a categorically better fit — and the funnel is what makes them stay. |
| **Price per message** | ~20× cheaper. |
| **Australian-native billing** | Manual EFT + proof upload + admin approval + BSB + AUD. Chatbase takes a US card, in USD, with FX. For a tradie or clinic, this is a genuine purchase blocker, and you've already solved it. |
| **No-code generic API engine at the entry tier** | Chatbase gates API access and advanced integrations at **$150/mo**. Yours works on the free plan. |
| **White-label from day one** | Chatbase charges $99/mo to remove branding; Enterprise-only white-label. You have no branding in the widget at all — so **reselling under a client's or agency's name is free.** That is the entire agency business model, handed to you. |
| **Agency operations** | Impersonation, user CRM, plan management, payment approval. Chatbase has no concept of "the agency that manages 40 client bots." |

### 6.4 Where they crush you today

Channels (Messenger, Instagram, WhatsApp, Slack, email, voice, telephony) · human handoff and shared helpdesk · website crawling and auto-retrain · Procedures (multi-step workflows) · outbound campaigns · team seats · conversation analytics and sentiment · SSO/audit/HIPAA · model breadth · and — decisively — **distribution**: 10,000 brands, G2 presence, an affiliate programme, and SEO on every "chatbot for X" query.

**And one margin problem they've solved that you haven't.** Chatbase sells **weighted "message credits,"** not messages — a frontier-model turn costs more credits than a cheap-model turn. You sell **raw message counts** while leaving the Model tab live and falling back to a shared `platform_api_key`. Do the arithmetic:

- 5,000 messages on `gpt-4o-mini` (~2,000 input + ~200 output tokens/turn) ≈ **$2** of API cost against $29 revenue. Excellent (~93% margin).
- The same 5,000 messages on a frontier model ≈ **$40–120**. **You lose money on every message**, and the subscriber flips that switch in the UI with two clicks.
- Now add gap #8: `stepCountIs(3)` means a tool-using turn can be 3 LLM calls metered as 1.
- And gap #7: the read-modify-write increment loses counts under concurrent load.
- And gap #9: with no `Origin` header the domain check is skipped entirely — so a third party can burn a subscriber's quota, on your key.

**Fix in this order: (1) atomic increment, (2) weighted credits per model, (3) count LLM calls not user turns, (4) harden the domain gate.** That's the difference between a business and an expensive hobby.

---

## Part 7 — What I'd recommend

### 7.1 Positioning

> **"The AI front desk for Australian service businesses — it answers, qualifies, and books, then drops a ranked lead into your pipeline."**

Not "build an AI chatbot." Lead with **leads and bookings** (revenue), not **support deflection** (cost saving), because your target customer has no support team to deflect from. And name the vertical — a plumber believes "for trades" and ignores "for business."

### 7.2 Sequence

**Now (weeks 1–3) — stop the leaks and fix onboarding**
1. Atomic `message_count` increment; meter LLM calls, not turns.
2. Weighted credits per model — or lock model choice per plan (and fix `LLM_USAGE_EXPLAINED.md`, which is now wrong).
3. Harden the domain gate: allowlist, subdomains, an explicit policy for absent `Origin`.
4. Encrypt API keys at rest; assert Upstash config in production.
5. **Website crawler + sitemap ingest.**
6. **Email + Slack/Teams notification on new enquiry.**

**Next (weeks 4–8) — make it sticky and sellable**
7. Human handoff (notification-based MVP).
8. Subscriber-facing conversation analytics — especially **"questions your bot couldn't answer."**
9. Team seats. Fixes the ARPU ceiling and unblocks agency accounts.
10. Cal.com / Google Calendar booking.
11. Zapier app + platform-level outbound events.
12. **Re-price.** Mid tier at $49–79, plus setup fees.

**Then (months 3–4) — channels and distribution**
13. The §5.1 channel refactor.
14. SMS via Twilio as the proving ground.
15. Instagram DM → Messenger (start Meta Business Verification and App Review **now**, in week 1 — it's calendar time, not work time).
16. WordPress plugin.
17. Connection-template library: Rezdy, Xero, ServiceM8, Shopify, HubSpot.

**Later** — WhatsApp (with pass-through billing modelled first), email-as-a-channel, voice, per-chatbot MCP servers.

### 7.3 Things I'd deliberately not build

Voice/telephony before 50 subscribers · SSO/HIPAA/audit logs (not your market) · your own vector DB (pgvector is fine well past 10k documents) · a full live-chat agent console (notification handoff covers 90% of the value) · Google Business Messages (**Google shut it down in July 2024** — if you see it on a competitor's integration list, that list is stale) · outbound campaign tooling (regulatory exposure under the Spam Act, low SMB competence, high abuse risk on your Meta app).

---

## Part 8 — Questions for our discussion

**On the business**
1. Is this **self-serve SaaS** or **an agency delivery tool**? The code says agency (impersonation, admin CRM, manual EFT, no branding) but the pricing says self-serve. These need different roadmaps, and choosing is the highest-leverage decision on this list.
2. Who is the first vertical? Trades, clinics, tours (you have Rezdy), real estate, professional services? **Pick one and win it** — a vertical-specific bot with pre-built connections beats a generic bot at any price.
3. Is $29/mo deliberate, or inherited from web-hosting instincts? (See §6.2.)
4. Will you resell under Jezweb's name, white-label for other agencies, or both?

**On the product**
5. Support-deflection or lead-generation? You've built lead-gen. Is that where you're aiming?
6. How much wrongness is acceptable, and who carries the liability when a bot quotes the wrong price?
7. Do you want the bot to *transact* (take payment, confirm a booking) or only to qualify and hand off?

**On integrations**
8. Which channel do your existing clients actually ask for — Instagram, WhatsApp, or Messenger? Ask five of them this week; it's worth more than any market report.
9. Your MCP roster (Xero, Rezdy, ERPNext, jezpress, SMTP2GO, Synergy Wholesale, australian-business) is a map of your client base. **Should the connection-template library simply mirror it?** That would be integration breadth at near-zero marginal cost.
10. Is the per-chatbot MCP server idea (§5.5) interesting to you? It's a genuine "nobody else does this" wedge, and it plays directly to a competency you already have.

---

## Appendix — Sources

**Chatbase:** [chatbase.co](https://www.chatbase.co/) · [pricing](https://www.chatbase.co/pricing)

**Consumer behaviour:** [SurveyMonkey — Customer Service Statistics 2026](https://www.surveymonkey.com/curiosity/customer-service-statistics/) · [chatbot.com](https://www.chatbot.com/blog/chatbot-statistics/) · [Botpress](https://botpress.com/blog/key-chatbot-statistics) · [Zendesk](https://www.zendesk.com/blog/ai/productivity/ai-customer-service-statistics/) · [Master of Code](https://masterofcode.com/blog/ai-in-customer-service-statistics)

**Meta / Messenger / Instagram:** [Messenger & IG Messaging policy (updated 6 Apr 2026)](https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy) · [Instagram Platform docs](https://developers.facebook.com/documentation/instagram-platform) · [24-hour window guide](https://www.keyapi.ai/blog/instagram-messaging-api-policy/) · [IG API approval guide 2026](https://singhamandeep.com/instagram-messaging-api-approval-getting-instagram_business_manage_messages-2026/)

**WhatsApp pricing:** [respond.io](https://respond.io/blog/whatsapp-business-api-pricing) · [Blueticks](https://blueticks.co/blog/whatsapp-business-api-pricing-2026) · [EngageLab](https://www.engagelab.com/blog/whatsapp-business-api-pricing) · [Authgear](https://www.authgear.com/post/whatsapp-api-pricing/)

**ElevenLabs / voice:** [Agents platform overview](https://elevenlabs.io/docs/agents-platform/overview) · [Custom LLM (bring your own)](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm) · [Dynamic variables](https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables) · [Post-call webhooks](https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks) · [Twilio native integration](https://elevenlabs.io/docs/agents-platform/phone-numbers/twilio-integration/native-integration) · [Agents pricing](https://elevenlabs.io/pricing/agents) · [HappyRobot pricing breakdown](https://www.happyrobot.ai/hub/elevenlabs-pricing) · [pxlpeak cost-per-minute math](https://pxlpeak.com/blog/ai-tools/elevenlabs-pricing-guide)

> Third-party prices and policy limits change frequently — re-verify Chatbase tiers and WhatsApp rates before quoting them to a client. The 1 Oct 2026 WhatsApp service-message change is imminent.
