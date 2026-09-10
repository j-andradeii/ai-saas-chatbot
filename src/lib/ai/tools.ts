import { tool, type Tool } from 'ai'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { unsendableHeader } from '@/lib/api-connection-headers'
import type { EnquiryFormField, ApiConnectionParameter } from '@/types'

/** Map a form field definition to a Zod schema */
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

/** Placeholder text generated per field type */
function getPlaceholder(field: EnquiryFormField): string {
  switch (field.type) {
    case 'email':
      return 'you@example.com'
    case 'phone':
      return '+61 4XX XXX XXX'
    case 'number':
      return '0'
    case 'date':
      return 'YYYY-MM-DD'
    case 'textarea':
      return `Enter your ${field.label.toLowerCase()}…`
    default:
      return `Enter ${field.label.toLowerCase()}`
  }
}

interface ToolContext {
  conversationId?: string
  visitorId?: string
  visitorIp?: string
}

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
/** Call-to-action rendered on every card produced by a connection. */
export interface ApiCardCta {
  type: 'form' | 'link'
  label: string
  /** type 'form': the enquiry-form tool name the widget should ask the assistant for. */
  formName?: string
  formDisplayName?: string
  /** type 'link': may contain {field} placeholders resolved per item by the widget. */
  url?: string
}

export interface ApiCardData {
  _apiData: true
  connectionName: string
  connectionDescription: string
  data: unknown
  cta?: ApiCardCta
}

/** Max items to include in card data for widget rendering */
const MAX_CARD_ITEMS = 25

/** Prepare data for widget card rendering — strip large fields, limit array items */
export function prepareCardData(data: unknown): unknown {
  // keepUrls: cards render image URLs, so they must survive intact
  const cleaned = stripLargeFields(data, true)
  if (Array.isArray(cleaned)) {
    return (cleaned as unknown[]).slice(0, MAX_CARD_ITEMS)
  }
  return cleaned
}

/** Max size for tool result data sent to the LLM (16KB) */
const MAX_TOOL_RESULT_SIZE = 16_000

/** A bare http(s) URL — no whitespace, so prose that merely contains a link doesn't match. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value)
}

/**
 * Strip large/binary fields (base64, long HTML) from objects.
 *
 * `keepUrls` matters for the card path: signed blob-storage URLs routinely run
 * past 500 characters, and truncating one produces a broken link rather than a
 * smaller payload. URLs are cheap in tokens anyway — it is base64 that bloats.
 */
function stripLargeFields(data: unknown, keepUrls = false): unknown {
  if (Array.isArray(data)) return data.map((item) => stripLargeFields(item, keepUrls))
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 500) {
        // Strip base64 data and very long HTML content
        if (value.includes('data:image') || value.includes('base64,')) {
          result[key] = '[image removed]'
        } else if (keepUrls && isHttpUrl(value)) {
          result[key] = value
        } else {
          result[key] = value.slice(0, 300) + '...(truncated)'
        }
      } else {
        result[key] = stripLargeFields(value, keepUrls)
      }
    }
    return result
  }
  return data
}

/** Truncate data to fit within LLM context limits */
function truncateForLLM(data: unknown): unknown {
  // First strip large/binary fields
  const cleaned = stripLargeFields(data)
  const serialized = JSON.stringify(cleaned)
  if (serialized.length <= MAX_TOOL_RESULT_SIZE) return cleaned

  // If it's an array, return as many items as fit
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

  // For non-array data, return a truncation message
  return { _truncated: true, _message: 'Response too large', _preview: serialized.slice(0, MAX_TOOL_RESULT_SIZE - 200) }
}

/** Replace {param} placeholders in a URL with actual values */
function interpolateUrl(urlTemplate: string, params: Record<string, unknown>): string {
  return urlTemplate.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key]
    return val !== undefined ? encodeURIComponent(String(val)) : `{${key}}`
  })
}

/** Extract a nested value from an object using dot-notation path (e.g. "data.bookings") */
function resolveResponsePath(data: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => {
    if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key]
    }
    return undefined
  }, data)
}

interface ChatbotToolsResult {
  tools: Record<string, Tool>
  enquiryFormNames: Set<string>
  apiConnectionNames: Set<string>
  apiCardData: ApiCardData[]
  /** Per-connection presentation guidance, injected into the system prompt. */
  apiCardInstructions: Array<{ connectionName: string; instructions: string }>
}

/** Fetch enquiry forms + chatbot tools, return AI SDK tool definitions */
export async function getChatbotTools(
  chatbotId: string,
  context?: ToolContext
): Promise<ChatbotToolsResult> {
  const tools: Record<string, Tool> = {}
  const enquiryFormNames = new Set<string>()
  const apiConnectionNames = new Set<string>()
  const apiCardData: ApiCardData[] = []
  const apiCardInstructions: Array<{ connectionName: string; instructions: string }> = []
  /** id -> form, so a CTA can name the form the assistant should raise. */
  const formsById = new Map<string, { name: string; display_name: string }>()

  // Fetch enquiry forms
  const { data: forms } = await supabaseAdmin
    .from('enquiry_forms')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .eq('is_enabled', true)

  if (forms) {
    for (const form of forms) {
      formsById.set(form.id, { name: form.name, display_name: form.display_name })
      const fields = form.fields as EnquiryFormField[]
      const shape: Record<string, z.ZodType> = {}

      for (const field of fields) {
        shape[field.name] = fieldToZod(field)
      }

      enquiryFormNames.add(form.name)

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
    }
  }

  // Fetch chatbot tools
  const { data: chatbotTools } = await supabaseAdmin
    .from('chatbot_tools')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .eq('is_enabled', true)

  if (chatbotTools) {
    for (const ct of chatbotTools) {
      const shape: Record<string, z.ZodType> = {}
      const params = ct.parameters as Record<string, string>

      for (const [key, type] of Object.entries(params)) {
        switch (type) {
          case 'number':
            shape[key] = z.number()
            break
          case 'boolean':
            shape[key] = z.boolean()
            break
          default:
            shape[key] = z.string()
        }
      }

      tools[ct.name] = tool({
        description: ct.description,
        inputSchema: z.object(shape),
        execute: async (input) => {
          if (ct.webhook_url) {
            try {
              const res = await fetch(ct.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tool_name: ct.name,
                  chatbot_id: chatbotId,
                  data: input,
                }),
              })
              return { success: res.ok, status: res.status }
            } catch {
              return { success: false, error: 'Webhook request failed' }
            }
          }
          return { success: true, data: input }
        },
      })
    }
  }

  // Fetch API connections
  const { data: apiConnections } = await supabaseAdmin
    .from('chatbot_api_connections')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .eq('is_enabled', true)

  if (apiConnections) {
    for (const conn of apiConnections) {
      const connParams = conn.parameters as ApiConnectionParameter[]
      const shape: Record<string, z.ZodType> = {}

      for (const p of connParams) {
        let s: z.ZodType
        switch (p.type) {
          case 'number':
            s = z.number().describe(p.description)
            break
          case 'boolean':
            s = z.boolean().describe(p.description)
            break
          default:
            s = z.string().describe(p.description)
        }
        if (!p.required) {
          s = s.optional() as z.ZodType
        }
        shape[p.name] = s
      }

      apiConnectionNames.add(conn.name)

      if (conn.card_instructions) {
        apiCardInstructions.push({ connectionName: conn.name, instructions: conn.card_instructions })
      }

      // Resolved once per connection, then attached to each card payload.
      let cta: ApiCardCta | undefined
      if (conn.cta_type === 'link' && conn.cta_url) {
        cta = { type: 'link', label: conn.cta_label || 'View details', url: conn.cta_url }
      } else if (conn.cta_type === 'form' && conn.cta_form_id) {
        const f = formsById.get(conn.cta_form_id)
        // A disabled or deleted form yields no CTA rather than a dead button.
        if (f) {
          cta = {
            type: 'form',
            label: conn.cta_label || 'Enquire',
            formName: f.name,
            formDisplayName: f.display_name,
          }
        }
      }

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
                // Interpolate param values into the body template
                const template = JSON.parse(JSON.stringify(conn.request_body_template))
                for (const [key, val] of Object.entries(params)) {
                  replaceInObject(template, `{${key}}`, val)
                }
                body = JSON.stringify(template)
              } else {
                body = JSON.stringify(params)
              }
            }

            // A header carrying non-latin-1 characters (e.g. a masked secret that
            // was saved back verbatim) makes fetch throw an opaque ByteString
            // TypeError. Fail with something the owner can act on instead.
            const badHeader = unsendableHeader(headers)
            if (badHeader) {
              // Owner-facing detail goes to the server log; the visitor only ever
              // sees whatever the assistant makes of the generic failure.
              console.error(
                `API connection "${conn.name}": header "${badHeader}" holds characters that cannot be sent ` +
                  `(likely a masked secret saved back verbatim). Re-enter its value in the connection settings.`
              )
              return { success: false, error: 'This data source is misconfigured.' }
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
              ...(cta ? { cta } : {}),
            })

            // Return truncated data for LLM context (16KB limit)
            return { success: true, data: truncateForLLM(data) }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'API request failed'
            return { success: false, error: message }
          }
        },
      })
    }
  }

  return { tools, enquiryFormNames, apiConnectionNames, apiCardData, apiCardInstructions }
}

/** Recursively replace string placeholders in an object */
function replaceInObject(obj: Record<string, unknown>, placeholder: string, value: unknown): void {
  for (const key of Object.keys(obj)) {
    if (obj[key] === placeholder) {
      obj[key] = value
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      replaceInObject(obj[key] as Record<string, unknown>, placeholder, value)
    }
  }
}
