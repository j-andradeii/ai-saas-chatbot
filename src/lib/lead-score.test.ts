import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateObject = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}))

const mockGetModel = vi.fn().mockResolvedValue({ id: 'fake-model' })
vi.mock('@/lib/ai/provider', () => ({
  getModelForChatbot: (...args: unknown[]) => mockGetModel(...args),
}))

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { scoreEnquiry } from './lead-score'

const enquiryRow = {
  id: 'enq-1',
  form_name: 'booking_form',
  data: { email: 'a@b.com', booking: '3D2N Package' },
  conversation_id: 'conv-1',
  chatbot_id: 'chatbot-1',
}

const chatbotRow = { llm_provider: 'google', llm_model: 'gemini-3.8-flash', api_key: '' }

/** Captures the update payload so assertions can inspect what was persisted. */
let updatePayload: Record<string, unknown> | null = null

function mockTables(options: { messages?: { role: string; content: string }[] } = {}) {
  updatePayload = null
  const messages = options.messages ?? [
    { role: 'user', content: 'Do you have availability on the 14th for 4 people?' },
    { role: 'assistant', content: 'Yes, we do.' },
  ]

  mockFrom.mockImplementation((table: string) => {
    if (table === 'enquiries') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: enquiryRow }),
          }),
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload
          return { eq: vi.fn().mockResolvedValue({ error: null }) }
        }),
      }
    }
    if (table === 'chatbots') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: chatbotRow }),
          }),
        }),
      }
    }
    if (table === 'messages') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: messages }),
              }),
            }),
          }),
        }),
      }
    }
    throw new Error(`unexpected table: ${table}`)
  })
}

describe('scoreEnquiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetModel.mockResolvedValue({ id: 'fake-model' })
  })

  it('persists the score, rationale and signals', async () => {
    mockTables()
    mockGenerateObject.mockResolvedValue({
      object: { score: 82, rationale: 'Gave dates and party size.', signals: ['exact date'] },
    })

    const result = await scoreEnquiry('enq-1')

    expect(result?.score).toBe(82)
    expect(updatePayload).toMatchObject({
      lead_score: 82,
      lead_score_rationale: 'Gave dates and party size.',
      lead_score_signals: ['exact date'],
      lead_score_model: 'gemini-3.8-flash',
    })
    expect(updatePayload?.lead_scored_at).toEqual(expect.any(String))
  })

  it('scores with the chatbot own provider', async () => {
    mockTables()
    mockGenerateObject.mockResolvedValue({
      object: { score: 50, rationale: 'x', signals: [] },
    })

    await scoreEnquiry('enq-1')

    expect(mockGetModel).toHaveBeenCalledWith(chatbotRow)
  })

  it('puts the transcript in the prompt', async () => {
    mockTables()
    mockGenerateObject.mockResolvedValue({
      object: { score: 70, rationale: 'x', signals: [] },
    })

    await scoreEnquiry('enq-1')

    const call = mockGenerateObject.mock.calls[0][0]
    expect(call.prompt).toContain('availability on the 14th')
    expect(call.prompt).toContain('booking_form')
    // Deterministic: the same conversation must not drift between runs.
    expect(call.temperature).toBe(0)
  })

  it('still scores when there is no transcript', async () => {
    mockTables({ messages: [] })
    mockGenerateObject.mockResolvedValue({
      object: { score: 40, rationale: 'Thin evidence.', signals: [] },
    })

    const result = await scoreEnquiry('enq-1')

    expect(result?.score).toBe(40)
    expect(mockGenerateObject.mock.calls[0][0].prompt).toContain('no chat transcript')
  })

  it('returns null and writes nothing when the model call fails', async () => {
    mockTables()
    mockGenerateObject.mockRejectedValue(new Error('provider is currently disabled'))

    const result = await scoreEnquiry('enq-1')

    // The enquiry is already saved; a scoring outage must not surface as a
    // failed submission, and must not leave a misleading 0 behind.
    expect(result).toBeNull()
    expect(updatePayload).toBeNull()
  })
})
