# How LLM Usage Works — API Keys, Costs & Message Flow

## The Short Answer

**All chatbots use the platform's API key**, set by the admin. Users do not provide or see any API keys. When a customer sends a message to a chatbot, the platform makes an API call to OpenAI (or whichever provider is configured) using the admin's key, and that call is billed to the admin's OpenAI account.

---

## How It Works Step-by-Step

### 1. Admin Configures the API Key

The admin goes to `/admin/providers` and enters an OpenAI API key (e.g. `sk-proj-...`). This key is stored encrypted in the `llm_providers` table.

```
Admin Panel → LLM Providers → OpenAI → Enter API Key → Save
```

### 2. Chatbot Defaults

Every chatbot is created with these defaults (from the database schema):

| Field | Default Value |
|-------|--------------|
| `llm_provider` | `openai` |
| `llm_model` | `gpt-4o-mini` |
| `api_key` | `''` (empty — uses platform key) |

Since we removed the Model tab, users cannot change these. All chatbots use `openai` / `gpt-4o-mini` with the platform's shared API key.

### 3. Customer Sends a Message

When a visitor on a user's website types a message into the chat widget:

```
Visitor → Widget → POST /api/chat/{chatbotId} → Server
```

### 4. Server Resolves the API Key

The chat API (`src/app/api/chat/[chatbotId]/route.ts`) does this:

1. Fetches the chatbot record (including `llm_provider`, `llm_model`, `api_key`)
2. Calls `getModelForChatbot(chatbot)` in `src/lib/ai/provider.ts`

The provider function follows this logic:

```
Does the chatbot have its own api_key?
  ├── YES → Use that key (not applicable since users can't set one anymore)
  └── NO  → Fetch the platform key from llm_providers table
              ├── Key exists & provider enabled → Use it
              └── Key missing or disabled → Error: "No API key configured"
```

### 5. API Call to OpenAI

The server makes a streaming API call to OpenAI:

```
Server → OpenAI API (using platform's sk-proj-... key)
       → Model: gpt-4o-mini
       → Messages: [system prompt + conversation history]
       → Response streams back to visitor's browser
```

### 6. Usage is Tracked

After the response completes, the server increments the chatbot owner's `message_count` in their profile. This counts against their plan limit (Free: 100, Pro: 5,000, Enterprise: 50,000).

---

## Who Pays for What

```
┌─────────────────────────────────────────────────┐
│                    ADMIN (You)                   │
│                                                  │
│  Pays: OpenAI API bill (all chatbot traffic)     │
│  Sets: API key in /admin/providers               │
│  Controls: Which providers/models are available  │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │              USER (Your Customer)           │ │
│  │                                             │ │
│  │  Pays: Platform subscription (EFT)          │ │
│  │  Gets: Message quota per billing period     │ │
│  │  Creates: Chatbots (within plan limit)      │ │
│  │                                             │ │
│  │  ┌───────────────────────────────────────┐  │ │
│  │  │        VISITOR (End Customer)         │  │ │
│  │  │                                       │  │ │
│  │  │  Pays: Nothing                        │  │ │
│  │  │  Does: Chats with the widget          │  │ │
│  │  │  Each message = 1 API call to OpenAI  │  │ │
│  │  └───────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Cost Example

Suppose you set the platform to use OpenAI `gpt-4o-mini`:

| OpenAI Pricing (gpt-4o-mini) | Cost |
|------------------------------|------|
| Input | $0.15 per 1M tokens |
| Output | $0.60 per 1M tokens |

A typical chat message is ~500 input tokens and ~300 output tokens:

```
Per message cost ≈ (500 × $0.15 / 1M) + (300 × $0.60 / 1M)
                 ≈ $0.000075 + $0.000180
                 ≈ $0.000255 (~$0.00026)
```

| Scenario | Messages | Approx. OpenAI Cost |
|----------|----------|-------------------|
| 1 Free user (maxed out) | 100 | ~$0.03 |
| 1 Pro user (maxed out) | 5,000 | ~$1.28 |
| 1 Enterprise user (maxed out) | 50,000 | ~$12.75 |
| 10 Pro users (all maxed) | 50,000 | ~$12.75 |

Your revenue from 10 Pro users on monthly billing: **$290/month**
Your OpenAI cost if they all max out: **~$12.75/month**

**The margins are very healthy with gpt-4o-mini.**

---

## What the Admin Controls

| Setting | Location | Effect |
|---------|----------|--------|
| API Key | `/admin/providers` | Which OpenAI/Anthropic/Google key is used for all API calls |
| Enable/Disable Provider | `/admin/providers` | Toggle a provider on/off (disabled = chatbots using it will error) |
| Plan Message Limits | `/admin/settings` | How many messages each plan tier allows |
| Rate Limits | `/admin/settings` | Max messages per minute per IP (prevents abuse) |

## What the User Controls

| Setting | Location | Effect |
|---------|----------|--------|
| Personality prompt | Chatbot → Personality tab | System prompt that shapes the AI's behavior |
| Skills | Chatbot → Skills tab | What the chatbot can help with |
| Knowledge base | Chatbot → Knowledge tab | Documents the AI can reference (RAG) |
| Quick actions | Chatbot → Quick Actions tab | Suggested prompts shown to visitors |
| Widget appearance | Chatbot → Widget tab | Colors, position |
| Enquiry forms | Chatbot → Enquiry Forms tab | Forms the AI can present to collect info |

## What the User Does NOT Control

- Which LLM provider is used (admin decides)
- Which model is used (defaults to `gpt-4o-mini`)
- API keys (shared platform key only)
- Token costs (absorbed by the platform)
