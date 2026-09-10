# Widget Rendering — AI SDK v6 Forms & Data Cards

**Confirmed: The chatbot widget fully renders AI SDK v6 tool call outputs** — Enquiry Forms and API Data Cards. Both flow from AI SDK v6 `streamText()` tool results through a custom marker protocol to client-side DOM rendering.

---

## Architecture Flow

```
streamText() (AI SDK v6)
    ↓
fullStream async iterable
    ↓
Chat API processes stream parts:
  • text-delta → pipe to client
  • tool-result → capture form/card output
    ↓
Append markers after stream completes:
  __FORM__{ json }__ENDFORM__
  __APIDATA__{ json }__ENDAPIDATA__
    ↓
Widget reads stream via ReadableStream.getReader()
    ↓
Regex-parses markers from accumulated text
    ↓
renderForm() / renderApiCards() → DOM elements
```

---

## 1. Tool Definitions — `src/lib/ai/tools.ts`

### Interfaces

```typescript
// src/lib/ai/tools.ts:71-87

/** Form output returned by the AI SDK tool execute — the tool generates the form */
export interface GeneratedFormOutput {
  _form: true
  id: string
  name: string
  display_name: string
  fields: Array<EnquiryFormField & { placeholder: string }>
  prefill: Record<string, unknown>
  success_message: string
}

/** Card data collected by API connection tools — used by widget card rendering */
export interface ApiCardData {
  _apiData: true
  connectionName: string
  connectionDescription: string
  data: unknown
}
```

### Enquiry Form Tool Registration

```typescript
// src/lib/ai/tools.ts:203-227

tools[form.name] = tool({
  description:
    (form.description || `Collect ${form.display_name} information`) +
    '. Pre-fill any fields you already know from the conversation.',
  inputSchema: z.object(shape),
  execute: async (input) => {
    // AI SDK generates the form: combine field definitions with AI-extracted values
    const enrichedFields = fields.map((f) => ({
      ...f,
      placeholder: getPlaceholder(f),
    }))

    return {
      _form: true,
      id: form.id,
      name: form.name,
      display_name: form.display_name,
      fields: enrichedFields,
      prefill: input as Record<string, unknown>,
      success_message:
        form.success_message || 'Thank you! Your enquiry has been submitted.',
    } satisfies GeneratedFormOutput
  },
})
```

### Field-to-Zod Schema Mapping

```typescript
// src/lib/ai/tools.ts:7-44

export function fieldToZod(field: EnquiryFormField): z.ZodType {
  let schema: z.ZodType

  switch (field.type) {
    case 'email':
      schema = z.string().email()
      break
    case 'phone':
      schema = z.string().min(1)
      break
    case 'number':
      schema = z.number()
      break
    case 'textarea':
      schema = z.string()
      break
    case 'select':
      if (field.options && field.options.length > 0) {
        schema = z.enum(field.options as [string, ...string[]])
      } else {
        schema = z.string()
      }
      break
    case 'date':
      schema = z.string()
      break
    case 'string':
    default:
      schema = z.string()
      break
  }

  if (!field.required) {
    schema = schema.optional() as z.ZodType
  }

  return schema
}
```

### API Connection Tool Registration

```typescript
// src/lib/ai/tools.ts:313-386

tools[conn.name] = tool({
  description: conn.description,
  inputSchema: z.object(shape),
  execute: async (input) => {
    try {
      const params = input as Record<string, unknown>
      const url = interpolateUrl(conn.url, params)

      const headers: Record<string, string> = {
        ...(conn.headers as Record<string, string>),
      }

      const method = conn.method as string
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(method)

      if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json'
      }

      let body: string | undefined
      if (hasBody) {
        if (conn.request_body_template) {
          const template = JSON.parse(JSON.stringify(conn.request_body_template))
          for (const [key, val] of Object.entries(params)) {
            replaceInObject(template, `{${key}}`, val)
          }
          body = JSON.stringify(template)
        } else {
          body = JSON.stringify(params)
        }
      }

      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(conn.timeout_ms),
      })

      let data: unknown
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}`, data }
      }

      // Apply response path extraction if configured
      if (conn.response_path) {
        data = resolveResponsePath(data, conn.response_path)
      }

      // Stash card-friendly data (full items, capped at 25) for widget rendering
      apiCardData.push({
        _apiData: true,
        connectionName: conn.name,
        connectionDescription: conn.description,
        data: prepareCardData(data),
      })

      // Return truncated data for LLM context (16KB limit)
      return { success: true, data: truncateForLLM(data) }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'API request failed'
      return { success: false, error: message }
    }
  },
})
```

### Data Size Helpers

```typescript
// src/lib/ai/tools.ts:89-148

const MAX_CARD_ITEMS = 25

function prepareCardData(data: unknown): unknown {
  const cleaned = stripLargeFields(data)
  if (Array.isArray(cleaned)) {
    return (cleaned as unknown[]).slice(0, MAX_CARD_ITEMS)
  }
  return cleaned
}

const MAX_TOOL_RESULT_SIZE = 16_000

function stripLargeFields(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(stripLargeFields)
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 500) {
        if (value.includes('data:image') || value.includes('base64,')) {
          result[key] = '[image removed]'
        } else {
          result[key] = value.slice(0, 300) + '...(truncated)'
        }
      } else {
        result[key] = stripLargeFields(value)
      }
    }
    return result
  }
  return data
}

function truncateForLLM(data: unknown): unknown {
  const cleaned = stripLargeFields(data)
  const serialized = JSON.stringify(cleaned)
  if (serialized.length <= MAX_TOOL_RESULT_SIZE) return cleaned

  if (Array.isArray(cleaned)) {
    const items: unknown[] = []
    let size = 2 // []
    for (const item of cleaned) {
      const itemStr = JSON.stringify(item)
      if (size + itemStr.length + 1 > MAX_TOOL_RESULT_SIZE) break
      items.push(item)
      size += itemStr.length + 1
    }
    return [...items, { _truncated: true, _message: `Showing ${items.length} of ${(cleaned as unknown[]).length} items` }]
  }

  return { _truncated: true, _message: 'Response too large', _preview: serialized.slice(0, MAX_TOOL_RESULT_SIZE - 200) }
}
```

### URL Interpolation & Response Path Extraction

```typescript
// src/lib/ai/tools.ts:150-166

function interpolateUrl(urlTemplate: string, params: Record<string, unknown>): string {
  return urlTemplate.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key]
    return val !== undefined ? encodeURIComponent(String(val)) : `{${key}}`
  })
}

function resolveResponsePath(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key]
    }
    return undefined
  }, data)
}
```

---

## 2. Chat API Streaming — `src/app/api/chat/[chatbotId]/route.ts`

### Tool Fetching & System Prompt Injection

```typescript
// route.ts:166-209

// Fetch tools for this chatbot
const visitorIp = request.headers.get('x-forwarded-for') ?? undefined
const { tools, enquiryFormNames, apiConnectionNames, apiCardData } = await getChatbotTools(chatbotId, {
  conversationId: activeConversationId!,
  visitorId,
  visitorIp,
})
const hasTools = Object.keys(tools).length > 0

// ...system prompt building...

// Inject enquiry form tool instructions into system prompt
if (enquiryFormNames.size > 0) {
  const formNames = Array.from(enquiryFormNames).join(', ')
  systemPrompt += `\n\n## Enquiry Forms — MANDATORY TOOL USE
You have these enquiry form tools: ${formNames}.

RULES (you MUST follow ALL of these):
1. When the user mentions: contact, enquiry, form, get in touch, submit details, reach out, message us, or anything about filling in information — you MUST call the ${formNames} tool.
2. NEVER describe form fields in your text. NEVER write field names, labels, or placeholders as text.
3. Your ONLY text response should be a single brief sentence like "Here's the form:" — then CALL THE TOOL.
4. Pre-fill any fields you already know from the conversation (name, email, etc.).
5. The form will render automatically from the tool call. You do NOT need to describe it.`
}

// Inject API connection tool instructions into system prompt
if (apiConnectionNames.size > 0) {
  const apiNames = Array.from(apiConnectionNames).join(', ')
  systemPrompt += `\n\n## API Connections — Live Data
You have these data-fetching tools: ${apiNames}.
When the user asks for live data (bookings, stats, account info, etc.), use the relevant tool.

RULES:
1. After calling an API tool, provide ONLY a brief 1-2 sentence intro.
2. Do NOT list individual data items — they display as visual cards automatically.
3. If many items, mention the count.
4. If the API call fails, explain the error.`
}
```

### AI SDK v6 `streamText()` Call

```typescript
// route.ts:222-276

// Detect if user is likely asking for a form — force tool calling
const lastMsg = llmMessages[llmMessages.length - 1]?.content?.toLowerCase() || ''
const formKeywords = ['form', 'enquiry', 'contact', 'get in touch', 'submit', 'reach out', 'details', 'generate']
const likelyWantsForm = enquiryFormNames.size > 0 && formKeywords.some(kw => lastMsg.includes(kw))

// Stream the response
const result = streamText({
  model,
  system: systemPrompt || undefined,
  messages: llmMessages,
  ...(hasTools ? {
    tools,
    stopWhen: stepCountIs(likelyWantsForm ? 1 : 3),
    ...(likelyWantsForm ? { toolChoice: 'required' as const } : {}),
  } : {}),
  async onFinish({ text, steps }) {
    // Save the assistant's response
    await supabaseAdmin.from('messages').insert({
      conversation_id: activeConversationId,
      role: 'assistant',
      content: text,
    })

    // Save tool call messages from steps
    if (steps) {
      for (const step of steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            // AI SDK v6 uses 'input' property on typed tool calls
            const toolData = ('input' in tc ? tc.input : undefined) as Record<string, unknown> | undefined
            await supabaseAdmin.from('messages').insert({
              conversation_id: activeConversationId,
              role: 'tool',
              content: JSON.stringify(toolData ?? {}),
              tool_name: tc.toolName,
              tool_data: toolData ?? {},
            })
          }
        }
      }
    }

    // Increment message count on profile
    await supabaseAdmin
      .from('profiles')
      .update({ message_count: profile.message_count + 1 })
      .eq('id', chatbot.user_id)
  },
})
```

### Custom ReadableStream with Marker Injection

```typescript
// route.ts:278-330

// Custom stream: pipe text deltas and capture AI-generated form definitions from tool results
const encoder = new TextEncoder()
const generatedForms: Record<string, unknown>[] = []
const seenFormIds = new Set<string>()

const stream = new ReadableStream({
  async start(controller) {
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          controller.enqueue(encoder.encode(part.text))
        } else if (part.type === 'tool-result') {
          // AI SDK tool generated the form — capture the output (dedupe by form id)
          if (enquiryFormNames.has(part.toolName)) {
            const formOutput = part.output as Record<string, unknown>
            const formId = formOutput?.id as string
            if (formOutput && formOutput._form && !seenFormIds.has(formId)) {
              seenFormIds.add(formId)
              generatedForms.push(formOutput)
            }
          }
        }
      }

      // Append AI-generated form markers after the text stream
      for (const formDef of generatedForms) {
        const marker = `\n__FORM__${JSON.stringify(formDef)}__ENDFORM__`
        controller.enqueue(encoder.encode(marker))
      }

      // Append API data card markers (from tool execute store, not part.output)
      for (const cardDef of apiCardData) {
        const marker = `\n__APIDATA__${JSON.stringify(cardDef)}__ENDAPIDATA__`
        controller.enqueue(encoder.encode(marker))
      }

      controller.close()
    } catch (err) {
      controller.error(err)
    }
  },
})

const streamHeaders = new Headers({
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Conversation-Id': activeConversationId!,
  ...corsHeaders,
})

return new Response(stream, {
  status: 200,
  headers: streamHeaders,
})
```

---

## 3. Widget JavaScript — `src/app/api/widget/[chatbotId]/route.ts`

The widget is a self-contained IIFE (876 lines) served as `application/javascript`. All rendering is client-side DOM manipulation — no framework.

### Stream Reading & Marker Parsing

```javascript
// widget route.ts — inside sendMessage() (lines 745-857)

async function sendMessage() {
  var text = input.value.trim();
  if (!text) return;

  messages.push({ role: 'user', content: text });
  input.value = '';
  isThinking = true;
  renderMessages();

  try {
    var payload = {
      messages: messages.slice(-20),
      visitorId: visitorId
    };
    if (conversationId) payload.conversationId = conversationId;

    var res = await fetch(API_BASE + '/api/chat/' + CHATBOT_ID, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Capture conversation ID from response headers
    var respConvId = res.headers.get('X-Conversation-Id');
    if (respConvId) conversationId = respConvId;

    // ...error handling...

    isThinking = false;
    var assistantMsg = { role: 'assistant', content: '' };
    messages.push(assistantMsg);

    // Stream reading via ReadableStream
    var streamed = false;
    if (res.body && typeof res.body.getReader === 'function') {
      try {
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        while (true) {
          var readResult = await reader.read();
          if (readResult.done) break;
          var chunk = decoder.decode(readResult.value, { stream: true });
          assistantMsg.content += chunk;
          streamed = true;
          renderMessages();  // Re-renders on every chunk for live typing effect
        }
      } catch (streamErr) {
        console.warn('[Widget] Stream reading failed:', streamErr);
      }
    }

    // Fallback: if stream produced nothing, read as text
    if (!assistantMsg.content && !streamed) {
      try {
        var fullText = await res.text();
        assistantMsg.content = fullText;
      } catch(e) {}
    }

    if (!assistantMsg.content) {
      assistantMsg.content = 'Sorry, I could not generate a response.';
    }

    // ===== FORM MARKER PARSING =====
    var formRegex = /__FORM__([\s\S]*?)__ENDFORM__/g;
    var formMatch;
    var formDefs = [];
    while ((formMatch = formRegex.exec(assistantMsg.content)) !== null) {
      try { formDefs.push(JSON.parse(formMatch[1])); } catch(e) {}
    }

    if (formDefs.length > 0) {
      assistantMsg.content = assistantMsg.content.replace(/__FORM__[\s\S]*?__ENDFORM__/g, '').trim();
      if (!assistantMsg.content) assistantMsg.content = 'Please fill in the form below.';
      assistantMsg.formDefs = formDefs;
      assistantMsg.formSubmitted = false;
    }

    // ===== API DATA MARKER PARSING =====
    var apiDataRegex = /__APIDATA__([\s\S]*?)__ENDAPIDATA__/g;
    var apiDataMatch;
    var apiDataDefs = [];
    while ((apiDataMatch = apiDataRegex.exec(assistantMsg.content)) !== null) {
      try { apiDataDefs.push(JSON.parse(apiDataMatch[1])); } catch(e) {}
    }

    if (apiDataDefs.length > 0) {
      assistantMsg.content = assistantMsg.content.replace(/__APIDATA__[\s\S]*?__ENDAPIDATA__/g, '').trim();
      if (!assistantMsg.content) assistantMsg.content = 'Here are the results:';
      assistantMsg.apiDataDefs = apiDataDefs;
    }

    renderMessages();
  } catch (err) {
    isThinking = false;
    messages.push({ role: 'assistant', content: 'Network error. Please check your connection and try again.' });
    renderMessages();
  } finally {
    sendBtn.disabled = false;
    input.disabled = false;
    input.focus();
  }
}
```

### Message Rendering — Forms & Cards Attachment Point

```javascript
// widget route.ts — renderMessages() (lines 686-729)

function renderMessages() {
  messagesEl.innerHTML = '';
  messages.forEach(function(msg) {
    var row = document.createElement('div');
    row.className = 'aichatbot-row ' + msg.role;

    if (msg.role === 'assistant') {
      row.appendChild(createAvatar());
    }

    var bubble = document.createElement('div');
    bubble.className = 'aichatbot-msg ' + msg.role;
    bubble.textContent = msg.content;
    row.appendChild(bubble);

    messagesEl.appendChild(row);

    // Render enquiry forms inline after assistant bubble
    if (msg.role === 'assistant' && msg.formDefs && !msg.formSubmitted) {
      msg.formDefs.forEach(function(fd) {
        renderForm(fd, row);
      });
    }

    // Render API data cards inline after assistant bubble
    if (msg.role === 'assistant' && msg.apiDataDefs) {
      msg.apiDataDefs.forEach(function(ad) {
        renderApiCards(ad, row);
      });
    }
  });

  if (isThinking) {
    var thinkRow = document.createElement('div');
    thinkRow.className = 'aichatbot-thinking-row';
    thinkRow.appendChild(createAvatar());
    var thinkDiv = document.createElement('div');
    thinkDiv.className = 'aichatbot-thinking';
    thinkDiv.innerHTML = '<span></span><span></span><span></span>';
    thinkRow.appendChild(thinkDiv);
    messagesEl.appendChild(thinkRow);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  renderQuickActions();
}
```

### `renderForm()` — Full Enquiry Form DOM Builder

```javascript
// widget route.ts (lines 315-413)

function renderForm(formDef, parentRow) {
  var container = document.createElement('div');
  container.className = 'aichatbot-form-container';

  // Form header with icon and title
  var header = document.createElement('div');
  header.className = 'aichatbot-form-header';
  header.innerHTML = ICON_FORM;
  var title = document.createElement('div');
  title.className = 'aichatbot-form-title';
  title.textContent = formDef.display_name;
  header.appendChild(title);
  container.appendChild(header);

  // Form body
  var body = document.createElement('div');
  body.className = 'aichatbot-form-body';

  var form = document.createElement('form');
  form.setAttribute('novalidate', '');
  form.setAttribute('autocomplete', 'off');

  formDef.fields.forEach(function(field, idx) {
    var group = document.createElement('div');
    group.className = 'aichatbot-form-group';

    var label = document.createElement('label');
    label.className = 'aichatbot-form-label';
    label.textContent = field.label;
    if (field.required) {
      var req = document.createElement('span');
      req.className = 'aichatbot-required';
      req.textContent = '*';
      label.appendChild(req);
    }
    group.appendChild(label);

    var el;
    if (field.type === 'textarea') {
      el = document.createElement('textarea');
      el.className = 'aichatbot-form-textarea';
      if (field.placeholder) el.placeholder = field.placeholder;
    } else if (field.type === 'select') {
      el = document.createElement('select');
      el.className = 'aichatbot-form-select';
      var emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = 'Select ' + field.label.toLowerCase() + '\u2026';
      el.appendChild(emptyOpt);
      (field.options || []).forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        el.appendChild(o);
      });
    } else {
      el = document.createElement('input');
      el.className = 'aichatbot-form-input';
      var typeMap = { string: 'text', email: 'email', phone: 'tel', number: 'number', date: 'date' };
      el.type = typeMap[field.type] || 'text';
      if (field.placeholder) el.placeholder = field.placeholder;
    }
    el.name = field.name;
    if (field.required) el.required = true;

    // Pre-fill with AI-extracted values from the conversation
    var isPrefilled = formDef.prefill && formDef.prefill[field.name] != null && String(formDef.prefill[field.name]) !== '';
    if (isPrefilled) {
      el.value = String(formDef.prefill[field.name]);
      el.classList.add('prefilled');
    }

    group.appendChild(el);

    var errorEl = document.createElement('div');
    errorEl.className = 'aichatbot-form-error';
    errorEl.style.display = 'none';
    group.appendChild(errorEl);

    form.appendChild(group);
  });

  var submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'aichatbot-form-submit';
  submitBtn.innerHTML = 'Submit ' + ICON_ARROW;
  form.appendChild(submitBtn);

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    handleFormSubmit(formDef, form, submitBtn, container);
  });

  body.appendChild(form);
  container.appendChild(body);
  parentRow.appendChild(container);
}
```

### `handleFormSubmit()` — Validation & Submission

```javascript
// widget route.ts (lines 415-495)

async function handleFormSubmit(formDef, formEl, submitBtn, containerEl) {
  // Clear previous errors
  formEl.querySelectorAll('.aichatbot-form-error').forEach(function(el) {
    el.style.display = 'none';
    el.textContent = '';
  });

  // Collect data
  var data = {};
  var hasError = false;
  formDef.fields.forEach(function(field) {
    var el = formEl.querySelector('[name="' + field.name + '"]');
    var val = el ? el.value.trim() : '';
    if (field.required && !val) {
      hasError = true;
      var errEl = el.parentNode.querySelector('.aichatbot-form-error');
      errEl.textContent = field.label + ' is required';
      errEl.style.display = 'block';
      return;
    }
    if (val && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      hasError = true;
      var errEl = el.parentNode.querySelector('.aichatbot-form-error');
      errEl.textContent = 'Invalid email address';
      errEl.style.display = 'block';
      return;
    }
    if (field.type === 'number' && val) {
      data[field.name] = Number(val);
    } else {
      data[field.name] = val;
    }
  });

  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    var res = await fetch(API_BASE + '/api/enquiries/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatbotId: CHATBOT_ID,
        formId: formDef.id,
        data: data,
        conversationId: conversationId,
        visitorId: visitorId
      })
    });

    var result = await res.json();

    if (res.ok && result.success) {
      // Replace form with success message
      containerEl.innerHTML = ICON_CHECK + '<span>' + (result.message || formDef.success_message) + '</span>';
      containerEl.className = 'aichatbot-form-success';
      // Mark the message so form won't re-render
      messages.forEach(function(m) { if (m.formDefs) m.formSubmitted = true; });
    } else if (result.errors) {
      // Show field-level errors from server
      Object.keys(result.errors).forEach(function(name) {
        var el = formEl.querySelector('[name="' + name + '"]');
        if (el) {
          var errEl = el.parentNode.querySelector('.aichatbot-form-error');
          errEl.textContent = result.errors[name];
          errEl.style.display = 'block';
        }
      });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    } else {
      submitBtn.textContent = result.error || 'Submission failed';
      setTimeout(function() { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }, 2000);
    }
  } catch (err) {
    submitBtn.textContent = 'Network error';
    setTimeout(function() { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }, 2000);
  }
}
```

### `renderApiCards()` — Full API Data Card DOM Builder

```javascript
// widget route.ts (lines 497-684)

// --- Helper functions ---

var TITLE_FIELDS = ['name', 'title', 'event_name', 'subject', 'heading', 'label', 'display_name', 'full_name'];
function detectTitleField(obj) {
  for (var i = 0; i < TITLE_FIELDS.length; i++) {
    if (obj[TITLE_FIELDS[i]] && typeof obj[TITLE_FIELDS[i]] === 'string') return TITLE_FIELDS[i];
  }
  return null;
}

function isStatusField(key) { return /status|state|publish_status/.test(key); }
function isDateField(key) { return /date|_at$|_on$|start|end|created|updated|scheduled/.test(key); }

function statusBadgeClass(val) {
  var v = String(val).toLowerCase();
  if (/active|published|approved|open|confirmed|success/.test(v)) return 'aichatbot-badge-green';
  if (/pending|draft|review|waiting/.test(v)) return 'aichatbot-badge-yellow';
  if (/failed|error|rejected|cancelled|closed|expired/.test(v)) return 'aichatbot-badge-red';
  if (/inactive|unpublished|disabled|archived/.test(v)) return 'aichatbot-badge-gray';
  return 'aichatbot-badge-blue';
}

function formatDate(val) {
  try {
    var d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch(e) { return String(val); }
}

var SKIP_KEYS = ['id', '_apiData', '_truncated', '_message', 'connectionName', 'connectionDescription', 'success'];
function extractDisplayFields(obj) {
  var fields = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length && fields.length < 6; i++) {
    var k = keys[i];
    if (SKIP_KEYS.indexOf(k) !== -1) continue;
    var v = obj[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v)) continue;
    var type = 'text';
    if (isStatusField(k)) type = 'status';
    else if (isDateField(k)) type = 'date';
    else if (typeof v === 'number') type = 'number';
    if (Array.isArray(v)) { v = v.length + ' items'; type = 'text'; }
    fields.push({ key: k, value: v, type: type });
  }
  return fields;
}

function createFieldElement(label, value, type) {
  var field = document.createElement('div');
  field.className = 'aichatbot-apicard-field';
  var lbl = document.createElement('div');
  lbl.className = 'aichatbot-apicard-label';
  lbl.textContent = humanizeLabel(label);
  field.appendChild(lbl);
  var val = document.createElement('div');
  val.className = 'aichatbot-apicard-value';
  if (type === 'status') {
    var badge = document.createElement('span');
    badge.className = 'aichatbot-badge ' + statusBadgeClass(value);
    badge.textContent = humanizeLabel(String(value));
    val.appendChild(badge);
  } else if (type === 'date') {
    val.textContent = formatDate(value);
  } else if (type === 'number') {
    val.textContent = typeof value === 'number' ? value.toLocaleString() : String(value);
  } else {
    val.textContent = String(value);
  }
  field.appendChild(val);
  return field;
}

function createDataCard(item) {
  var card = document.createElement('div');
  card.className = 'aichatbot-apicard';
  var titleKey = detectTitleField(item);
  if (titleKey) {
    var titleEl = document.createElement('div');
    titleEl.className = 'aichatbot-apicard-title';
    titleEl.textContent = String(item[titleKey]);
    titleEl.title = String(item[titleKey]);
    card.appendChild(titleEl);
  }
  var fieldsContainer = document.createElement('div');
  fieldsContainer.className = 'aichatbot-apicard-fields';
  var displayFields = extractDisplayFields(item);
  displayFields.forEach(function(f) {
    if (f.key === titleKey) return;
    fieldsContainer.appendChild(createFieldElement(f.key, f.value, f.type));
  });
  card.appendChild(fieldsContainer);
  return card;
}

/** Try to unwrap { data: [...] } or { results: [...] } style wrappers */
function unwrapData(data) {
  if (Array.isArray(data)) return { items: data, isArray: true };
  if (data && typeof data === 'object') {
    var arrayKeys = ['data', 'results', 'items', 'records', 'events', 'rows', 'entries', 'list'];
    var keys = Object.keys(data);
    for (var i = 0; i < arrayKeys.length; i++) {
      if (Array.isArray(data[arrayKeys[i]])) return { items: data[arrayKeys[i]], isArray: true };
    }
    for (var j = 0; j < keys.length; j++) {
      if (Array.isArray(data[keys[j]]) && data[keys[j]].length > 0) return { items: data[keys[j]], isArray: true };
    }
    return { items: [data], isArray: false };
  }
  return { items: [], isArray: false };
}

// --- Main card renderer ---

function renderApiCards(apiDataDef, parentRow) {
  var wrapper = document.createElement('div');
  wrapper.className = 'aichatbot-apidata-container';

  // Header with icon + title
  var headerEl = document.createElement('div');
  headerEl.className = 'aichatbot-apidata-header';
  headerEl.innerHTML = ICON_DATA;
  var titleEl = document.createElement('div');
  titleEl.className = 'aichatbot-apidata-title';
  titleEl.textContent = humanizeLabel(apiDataDef.connectionName || 'Results');
  headerEl.appendChild(titleEl);

  var unwrapped = unwrapData(apiDataDef.data);
  var items = unwrapped.items;
  var isArray = unwrapped.isArray;

  var realItems = items.filter(function(it) { return !(it && it._truncated); });
  var truncatedItem = items.filter(function(it) { return it && it._truncated; })[0];

  if (realItems.length > 0) {
    var countBadge = document.createElement('span');
    countBadge.className = 'aichatbot-apidata-count';
    countBadge.textContent = realItems.length + (realItems.length === 1 ? ' item' : ' items');
    headerEl.appendChild(countBadge);
  }

  wrapper.appendChild(headerEl);

  // LAYOUT BRANCH: empty / single detail / multi-card grid
  if (realItems.length === 0) {
    var emptyEl = document.createElement('div');
    emptyEl.className = 'aichatbot-apidata-empty';
    emptyEl.textContent = 'No data available';
    wrapper.appendChild(emptyEl);
  } else if (realItems.length === 1 && !isArray) {
    // Single non-array object — detail card layout
    var detail = document.createElement('div');
    detail.className = 'aichatbot-apicard-detail';
    var fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'aichatbot-apicard-fields';
    var titleKey = detectTitleField(realItems[0]);
    if (titleKey) {
      var cardTitle = document.createElement('div');
      cardTitle.className = 'aichatbot-apicard-title';
      cardTitle.textContent = String(realItems[0][titleKey]);
      detail.appendChild(cardTitle);
    }
    var displayFields = extractDisplayFields(realItems[0]);
    displayFields.forEach(function(f) {
      if (f.key === titleKey) return;
      fieldsContainer.appendChild(createFieldElement(f.key, f.value, f.type));
    });
    detail.appendChild(fieldsContainer);
    wrapper.appendChild(detail);
  } else {
    // Array items — horizontal scroll grid
    var grid = document.createElement('div');
    grid.className = 'aichatbot-apidata-grid';
    realItems.forEach(function(item) {
      grid.appendChild(createDataCard(item));
    });
    if (truncatedItem) {
      var moreCard = document.createElement('div');
      moreCard.className = 'aichatbot-apidata-more';
      moreCard.textContent = truncatedItem._message || 'More items available';
      grid.appendChild(moreCard);
    }
    wrapper.appendChild(grid);
  }

  parentRow.appendChild(wrapper);
}
```

---

## 4. CSS — Key Styles (inline in widget JS)

### Enquiry Form Styles

```css
/* Card container */
.aichatbot-form-container {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #edf0f3;
}

/* Gradient header */
.aichatbot-form-header {
  background: linear-gradient(135deg, PRIMARY_COLOR 0%, PRIMARY_COLORcc 100%);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Input fields */
.aichatbot-form-input, .aichatbot-form-textarea, .aichatbot-form-select {
  width: 100%;
  padding: 11px 14px;
  font-size: 14px;
  border: 1.5px solid #dde1e6;
  border-radius: 10px;
  background: #f8f9fb;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

/* Prefilled fields — tinted with primary color */
.aichatbot-form-input.prefilled {
  background: rgba(RGB, 0.04);
  border-color: rgba(RGB, 0.35);
}

/* Submit button */
.aichatbot-form-submit {
  width: 100%;
  padding: 13px 20px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, PRIMARY_COLOR 0%, PRIMARY_COLORcc 100%);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(RGB, 0.3);
}

/* Success state */
.aichatbot-form-success {
  padding: 14px 18px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 14px;
  color: #15803d;
}
```

### API Data Card Styles

```css
/* Header bar */
.aichatbot-apidata-header {
  background: linear-gradient(135deg, PRIMARY_COLOR 0%, PRIMARY_COLORcc 100%);
  padding: 14px 18px;
  border-radius: 14px 14px 0 0;
}

/* Horizontal scroll grid */
.aichatbot-apidata-grid {
  display: flex;
  gap: 10px;
  padding: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  background: #f4f5f7;
  border-radius: 0 0 14px 14px;
}

/* Individual cards */
.aichatbot-apicard {
  min-width: 220px;
  max-width: 280px;
  background: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  scroll-snap-align: start;
}

/* Status badges */
.aichatbot-badge-green  { background: #dcfce7; color: #166534; }
.aichatbot-badge-yellow { background: #fef9c3; color: #854d0e; }
.aichatbot-badge-red    { background: #fee2e2; color: #991b1b; }
.aichatbot-badge-blue   { background: #dbeafe; color: #1e40af; }
.aichatbot-badge-gray   { background: #f3f4f6; color: #4b5563; }

/* Detail card (single item) */
.aichatbot-apicard-detail {
  background: #ffffff;
  border-radius: 0 0 14px 14px;
  border: 1px solid #edf0f3;
  padding: 16px 18px;
}

/* Empty state */
.aichatbot-apidata-empty {
  padding: 20px;
  text-align: center;
  color: #9ca3af;
  background: #f4f5f7;
  border-radius: 0 0 14px 14px;
}
```

---

## 5. File Reference

| File | Lines | Role |
|------|-------|------|
| `src/lib/ai/tools.ts` | 1-401 | Tool definitions — enquiry forms, custom tools, API connections, data helpers |
| `src/app/api/chat/[chatbotId]/route.ts` | 1-344 | AI SDK v6 streamText(), fullStream iteration, marker injection |
| `src/app/api/widget/[chatbotId]/route.ts` | 1-886 | Complete widget JS — stream reading, marker parsing, DOM rendering |
| `src/app/api/enquiries/submit/route.ts` | — | Form submission endpoint |
