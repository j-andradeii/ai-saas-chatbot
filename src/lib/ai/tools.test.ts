import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// We need to mock 'ai' to provide a simple tool function
vi.mock('ai', () => ({
  tool: (def: { description: string; inputSchema: z.ZodType; execute: (...args: unknown[]) => unknown }) => def,
}))

import { fieldToZod, getChatbotTools, prepareCardData } from './tools'
import type { EnquiryFormField } from '@/types'

describe('fieldToZod', () => {
  it('maps string type to z.string()', () => {
    const field: EnquiryFormField = { name: 'name', label: 'Name', type: 'string', required: true }
    const schema = fieldToZod(field)
    expect(schema.safeParse('hello').success).toBe(true)
    expect(schema.safeParse(123).success).toBe(false)
  })

  it('maps email type to z.string().email()', () => {
    const field: EnquiryFormField = { name: 'email', label: 'Email', type: 'email', required: true }
    const schema = fieldToZod(field)
    expect(schema.safeParse('test@example.com').success).toBe(true)
    expect(schema.safeParse('not-email').success).toBe(false)
  })

  it('maps number type to z.number()', () => {
    const field: EnquiryFormField = { name: 'age', label: 'Age', type: 'number', required: true }
    const schema = fieldToZod(field)
    expect(schema.safeParse(25).success).toBe(true)
    expect(schema.safeParse('25').success).toBe(false)
  })

  it('maps select type with options to z.enum()', () => {
    const field: EnquiryFormField = {
      name: 'color', label: 'Color', type: 'select', required: true,
      options: ['red', 'blue', 'green'],
    }
    const schema = fieldToZod(field)
    expect(schema.safeParse('red').success).toBe(true)
    expect(schema.safeParse('yellow').success).toBe(false)
  })

  it('makes field optional when required is false', () => {
    const field: EnquiryFormField = { name: 'phone', label: 'Phone', type: 'phone', required: false }
    const schema = fieldToZod(field)
    expect(schema.safeParse(undefined).success).toBe(true)
    expect(schema.safeParse('1234567890').success).toBe(true)
  })

  it('maps date type to z.string()', () => {
    const field: EnquiryFormField = { name: 'dob', label: 'Date of Birth', type: 'date', required: true }
    const schema = fieldToZod(field)
    expect(schema.safeParse('2024-01-15').success).toBe(true)
    expect(schema.safeParse(123).success).toBe(false)
  })

  it('maps textarea type to z.string()', () => {
    const field: EnquiryFormField = { name: 'msg', label: 'Message', type: 'textarea', required: true }
    const schema = fieldToZod(field)
    expect(schema.safeParse('long text here').success).toBe(true)
    expect(schema.safeParse(42).success).toBe(false)
  })

  it('maps select with no options to z.string()', () => {
    const field: EnquiryFormField = { name: 'choice', label: 'Choice', type: 'select', required: true, options: [] }
    const schema = fieldToZod(field)
    expect(schema.safeParse('anything').success).toBe(true)
  })
})

describe('getChatbotTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockSupabaseQueries(forms: unknown[] | null, tools: unknown[] | null, apiConnections: unknown[] | null = []) {
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      // Call order: 1=enquiry_forms, 2=chatbot_tools, 3=chatbot_api_connections
      const data = callCount === 1 ? forms : callCount === 2 ? tools : apiConnections
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data,
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    })
  }

  it('returns empty tools and enquiryFormNames when no forms or tools exist', async () => {
    mockSupabaseQueries([], [])
    const { tools, enquiryFormNames } = await getChatbotTools('chatbot-1')
    expect(tools).toEqual({})
    expect(enquiryFormNames.size).toBe(0)
  })

  it('creates tool with key matching form name and tracks enquiry form name', async () => {
    mockSupabaseQueries(
      [{
        id: 'form-1',
        name: 'contact_form',
        display_name: 'Contact Form',
        description: 'Collect contact info',
        fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
        webhook_url: null,
        success_message: 'Thanks!',
        is_enabled: true,
      }],
      []
    )

    const { tools, enquiryFormNames } = await getChatbotTools('chatbot-1')
    expect(tools).toHaveProperty('contact_form')
    expect(tools.contact_form.description).toContain('Collect contact info')
    expect(enquiryFormNames.has('contact_form')).toBe(true)
  })

  it('enquiry form execute generates form definition with AI-extracted prefill', async () => {
    mockSupabaseQueries(
      [{
        id: 'form-1',
        name: 'lead_form',
        display_name: 'Lead Form',
        description: 'Capture leads',
        fields: [{ name: 'name', label: 'Name', type: 'string', required: true }],
        webhook_url: null,
        success_message: 'Submitted!',
        is_enabled: true,
      }],
      []
    )

    const { tools } = await getChatbotTools('chatbot-1', {
      conversationId: 'conv-1',
      visitorId: 'visitor-1',
      visitorIp: '1.2.3.4',
    })

    const result = await tools.lead_form.execute({ name: 'John' }, { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal })
    // AI SDK tool generates the form with field definitions and prefilled values
    expect(result._form).toBe(true)
    expect(result.id).toBe('form-1')
    expect(result.display_name).toBe('Lead Form')
    expect(result.prefill).toEqual({ name: 'John' })
    expect(result.fields).toHaveLength(1)
    expect(result.fields[0].placeholder).toBeDefined()
    expect(result.success_message).toBe('Submitted!')
    // No DB insert — submission is handled by the widget
    expect(mockFrom).not.toHaveBeenCalledWith('enquiries')
  })

  it('creates chatbot tools with correct parameter schemas', async () => {
    mockSupabaseQueries([], [
      {
        id: 'ct-1',
        name: 'lookup_order',
        description: 'Look up order by ID',
        parameters: { order_id: 'string', amount: 'number', verified: 'boolean' },
        webhook_url: null,
        is_enabled: true,
      },
    ])

    const { tools } = await getChatbotTools('chatbot-1')
    expect(tools).toHaveProperty('lookup_order')
    expect(tools.lookup_order.description).toBe('Look up order by ID')
  })

  it('chatbot tool execute returns input data when no webhook', async () => {
    mockSupabaseQueries([], [{
      id: 'ct-1',
      name: 'greet',
      description: 'Greet user',
      parameters: { name: 'string' },
      webhook_url: null,
      is_enabled: true,
    }])

    const { tools } = await getChatbotTools('chatbot-1')
    const result = await tools.greet.execute(
      { name: 'Alice' },
      { toolCallId: 'tc-1', messages: [], abortSignal: new AbortController().signal }
    )
    expect(result).toEqual({ success: true, data: { name: 'Alice' } })
  })

  it('chatbot tool execute calls webhook and returns status', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 })
    mockSupabaseQueries([], [{
      id: 'ct-2',
      name: 'notify',
      description: 'Send notification',
      parameters: { message: 'string' },
      webhook_url: 'https://hooks.example.com/notify',
      is_enabled: true,
    }])

    const { tools } = await getChatbotTools('chatbot-1')
    const result = await tools.notify.execute(
      { message: 'hello' },
      { toolCallId: 'tc-2', messages: [], abortSignal: new AbortController().signal }
    )
    expect(result).toEqual({ success: true, status: 200 })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/notify',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('chatbot tool execute handles webhook failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    mockSupabaseQueries([], [{
      id: 'ct-3',
      name: 'fail_tool',
      description: 'Tool with failing webhook',
      parameters: { data: 'string' },
      webhook_url: 'https://bad.example.com/hook',
      is_enabled: true,
    }])

    const { tools } = await getChatbotTools('chatbot-1')
    const result = await tools.fail_tool.execute(
      { data: 'test' },
      { toolCallId: 'tc-3', messages: [], abortSignal: new AbortController().signal }
    )
    expect(result).toEqual({ success: false, error: 'Webhook request failed' })
  })

  it('uses default description when form has no description', async () => {
    mockSupabaseQueries(
      [{
        id: 'form-4',
        name: 'enquiry',
        display_name: 'General Enquiry',
        description: null,
        fields: [{ name: 'name', label: 'Name', type: 'string', required: true }],
        webhook_url: null,
        success_message: null,
        is_enabled: true,
      }],
      []
    )

    const { tools } = await getChatbotTools('chatbot-1')
    expect(tools.enquiry.description).toContain('Collect General Enquiry information')
  })

  it('uses default success message when form has no success_message', async () => {
    mockSupabaseQueries(
      [{
        id: 'form-5',
        name: 'default_msg',
        display_name: 'Test',
        description: 'Test form',
        fields: [{ name: 'q', label: 'Q', type: 'string', required: true }],
        webhook_url: null,
        success_message: null,
        is_enabled: true,
      }],
      []
    )

    const { tools } = await getChatbotTools('chatbot-1')
    const result = await tools.default_msg.execute(
      { q: 'test' },
      { toolCallId: 'tc-4', messages: [], abortSignal: new AbortController().signal }
    )
    expect(result._form).toBe(true)
    expect(result.success_message).toBe('Thank you! Your enquiry has been submitted.')
  })
})

describe('prepareCardData', () => {
  it('keeps a long signed image URL intact so the card can render it', () => {
    // Blob-storage URLs routinely exceed the 500-char strip threshold.
    const url = 'https://blob.vercel-storage.com/tours/' + 'x'.repeat(480) + '.jpg?token=abc'
    expect(url.length).toBeGreaterThan(500)
    const out = prepareCardData([{ name: 'Tour', image: url }]) as Array<{ image: string }>
    expect(out[0].image).toBe(url)
    expect(out[0].image).not.toContain('truncated')
  })

  it('still strips base64 image payloads', () => {
    const b64 = 'data:image/png;base64,' + 'A'.repeat(600)
    const out = prepareCardData([{ name: 'X', image: b64 }]) as Array<{ image: string }>
    expect(out[0].image).toBe('[image removed]')
  })

  it('still truncates long non-URL prose', () => {
    const prose = 'word '.repeat(200)
    const out = prepareCardData([{ name: 'X', body: prose }]) as Array<{ body: string }>
    expect(out[0].body).toContain('...(truncated)')
  })
})
