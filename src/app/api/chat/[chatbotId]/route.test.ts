import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockLimit = vi.fn()
vi.mock('@/lib/ratelimit', () => ({
  chatRatelimit: { limit: (...args: unknown[]) => mockLimit(...args) },
}))

const mockStreamText = vi.fn()
const mockStepCountIs = vi.fn()
vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
  stepCountIs: (...args: unknown[]) => mockStepCountIs(...args),
}))

const mockGetModelForChatbot = vi.fn().mockResolvedValue('mock-model')
vi.mock('@/lib/ai/provider', () => ({
  getModelForChatbot: (...args: unknown[]) => mockGetModelForChatbot(...args),
}))

const mockGetChatbotTools = vi.fn().mockResolvedValue({ tools: {}, enquiryFormNames: new Set(), apiConnectionNames: new Set(), apiCardData: [], apiCardInstructions: [] })
vi.mock('@/lib/ai/tools', () => ({
  getChatbotTools: (...args: unknown[]) => mockGetChatbotTools(...args),
}))

const mockSearchSimilarChunks = vi.fn().mockResolvedValue([])
vi.mock('@/lib/rag', () => ({
  searchSimilarChunks: (...args: unknown[]) => mockSearchSimilarChunks(...args),
}))

const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { POST, OPTIONS } from './route'

/** Create an async-iterable fullStream mock that yields text-delta parts */
function mockFullStream(text: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'text-delta' as const, text }
    },
  }
}

function createRequest(body: object, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/chat/chatbot-1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Helper to build sequential from() mocks for chatbot → profile → insert/update chains */
function mockFullChatbotProfileChain(
  chatbot: Record<string, unknown> | null,
  profile: Record<string, unknown> | null,
  opts?: { chatbotError?: boolean; profileError?: boolean }
) {
  let fromCallCount = 0
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'messages' || table === 'conversations') {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'conv-new' },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      }
    }
    if (table === 'profiles' && fromCallCount >= 1) {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: opts?.profileError ? null : profile,
              error: opts?.profileError ? { message: 'Profile error' } : null,
            }),
          }),
        }),
        update: updateMock,
      }
    }
    // Default: chatbots query
    fromCallCount++
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: opts?.chatbotError ? null : chatbot,
              error: opts?.chatbotError ? { message: 'Not found' } : null,
            }),
          }),
        }),
      }),
    }
  })

  return { insertMock, updateMock }
}

describe('POST /api/chat/[chatbotId]', () => {
  const params = Promise.resolve({ chatbotId: 'chatbot-1' })

  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue({ success: true })
    mockGetChatbotTools.mockResolvedValue({ tools: {}, enquiryFormNames: new Set(), apiConnectionNames: new Set(), apiCardData: [], apiCardInstructions: [] })
    mockSearchSimilarChunks.mockResolvedValue([])
    mockGetModelForChatbot.mockResolvedValue('mock-model')
  })

  it('returns 429 when rate limited', async () => {
    mockLimit.mockResolvedValue({ success: false })
    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(429)
  })

  it('returns 400 when messages array is missing', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', api_key: '' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    const req = createRequest({})
    const res = await POST(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages is empty array', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', api_key: '' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    const req = createRequest({ messages: [] })
    const res = await POST(req, { params })
    expect(res.status).toBe(400)
  })

  it('returns 404 when chatbot not found', async () => {
    mockFullChatbotProfileChain(null, null, { chatbotError: true })

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(404)
  })

  it('returns 403 when domain does not match', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: 'example.com', personality_prompt: '' },
      null
    )

    const req = createRequest(
      { messages: [{ role: 'user', content: 'hi' }] },
      { origin: 'https://evil.com' }
    )
    const res = await POST(req, { params })
    expect(res.status).toBe(403)
  })

  it('returns 500 when profile not found', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '' },
      null,
      { profileError: true }
    )

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Chatbot owner profile not found')
  })

  it('returns 403 when account is suspended', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '' },
      { message_count: 0, message_limit: 100, is_active: false }
    )

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Account suspended')
  })

  it('returns 402 when message limit exceeded', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '' },
      { message_count: 100, message_limit: 100, is_active: true }
    )

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(402)
  })

  it('returns 500 when conversation creation fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'chatbots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { message_count: 0, message_limit: 100, is_active: true },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'conversations') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create conversation')
  })

  it('streams successful response with CORS headers and conversation ID', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: 'You are helpful', skills: [], api_key: '' },
      { message_count: 5, message_limit: 100, is_active: true }
    )

    // Mock streamText to return a fullStream async iterable
    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('Hello there!'),
    })

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('X-Conversation-Id')).toBeTruthy()
    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        messages: expect.any(Array),
      })
    )
  })

  it('passes existing conversationId when provided', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', skills: [], api_key: '' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('ok'),
    })

    const req = createRequest({
      messages: [{ role: 'user', content: 'hi' }],
      conversationId: 'existing-conv-123',
    })
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Conversation-Id')).toBe('existing-conv-123')
  })

  it('includes tools and stepCountIs when chatbot has tools', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', skills: [], api_key: '' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    const mockTools = { contact_form: { description: 'Contact form', execute: vi.fn() } }
    mockGetChatbotTools.mockResolvedValue({ tools: mockTools, enquiryFormNames: new Set(), apiConnectionNames: new Set(), apiCardData: [], apiCardInstructions: [] })
    mockStepCountIs.mockReturnValue('step-count-sentinel')

    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('ok'),
    })

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    await POST(req, { params })

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: mockTools,
        stopWhen: 'step-count-sentinel',
      })
    )
  })

  it('injects skills into system prompt', async () => {
    mockFullChatbotProfileChain(
      {
        id: 'chatbot-1',
        user_id: 'user-1',
        domain: '',
        personality_prompt: 'Base prompt.',
        skills: ['answer_faqs', 'book_appointment'],
        api_key: '',
      },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('ok'),
    })

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    await POST(req, { params })

    const callArgs = mockStreamText.mock.calls[0][0]
    expect(callArgs.system).toContain('answering FAQs')
    expect(callArgs.system).toContain('booking appointments')
  })

  it('injects RAG context into system prompt', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: 'Base.', skills: [], api_key: '', llm_provider: 'google' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    mockSearchSimilarChunks.mockResolvedValue([
      { content: 'RAG chunk 1' },
      { content: 'RAG chunk 2' },
    ])

    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('ok'),
    })

    const req = createRequest({ messages: [{ role: 'user', content: 'what is this?' }] })
    await POST(req, { params })

    const callArgs = mockStreamText.mock.calls[0][0]
    expect(callArgs.system).toContain('RAG chunk 1')
    expect(callArgs.system).toContain('RAG chunk 2')
    expect(mockSearchSimilarChunks).toHaveBeenCalledWith('what is this?', 'chatbot-1', 5, 'google')
  })

  it('calls onFinish to save assistant message and increment count', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', skills: [], api_key: '' },
      { message_count: 5, message_limit: 100, is_active: true }
    )

    let capturedOnFinish: ((args: { text: string; steps?: unknown[] }) => Promise<void>) | null = null
    mockStreamText.mockImplementation((opts: { onFinish: typeof capturedOnFinish }) => {
      capturedOnFinish = opts.onFinish
      return {
        fullStream: mockFullStream('ok'),
      }
    })

    const req = createRequest({
      messages: [{ role: 'user', content: 'hi' }],
      conversationId: 'conv-1',
    })
    await POST(req, { params })

    // Invoke onFinish callback
    expect(capturedOnFinish).toBeTruthy()
    await capturedOnFinish!({ text: 'AI response text', steps: undefined })

    // Verify message insert was called for assistant response
    expect(mockFrom).toHaveBeenCalledWith('messages')
    // Verify profile update for message count
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    // Verify conversation updated_at
    expect(mockFrom).toHaveBeenCalledWith('conversations')
  })

  it('onFinish saves tool call messages from steps', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'chatbots') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'chatbot-1', user_id: 'user-1', domain: '', personality_prompt: '', skills: [], api_key: '' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { message_count: 0, message_limit: 100, is_active: true },
                error: null,
              }),
            }),
          }),
          update: updateMock,
        }
      }
      return {
        insert: insertMock,
        update: updateMock,
      }
    })

    let capturedOnFinish: ((args: { text: string; steps?: unknown[] }) => Promise<void>) | null = null
    mockStreamText.mockImplementation((opts: { onFinish: typeof capturedOnFinish }) => {
      capturedOnFinish = opts.onFinish
      return {
        fullStream: mockFullStream('ok'),
      }
    })

    const req = createRequest({
      messages: [{ role: 'user', content: 'hi' }],
      conversationId: 'conv-1',
    })
    await POST(req, { params })

    await capturedOnFinish!({
      text: 'Done',
      steps: [
        {
          toolCalls: [
            { toolName: 'contact_form', input: { email: 'a@b.com' } },
          ],
        },
      ],
    })

    // Verify tool message was inserted
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'tool',
        tool_name: 'contact_form',
        tool_data: { email: 'a@b.com' },
      })
    )
  })

  it('returns 500 on unexpected errors', async () => {
    mockLimit.mockRejectedValue(new Error('Unexpected'))

    const req = createRequest({ messages: [{ role: 'user', content: 'hi' }] })
    const res = await POST(req, { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('allows matching domain when origin and chatbot domain match', async () => {
    mockFullChatbotProfileChain(
      { id: 'chatbot-1', user_id: 'user-1', domain: 'https://example.com', personality_prompt: '', skills: [], api_key: '' },
      { message_count: 0, message_limit: 100, is_active: true }
    )

    mockStreamText.mockReturnValue({
      fullStream: mockFullStream('ok'),
    })

    const req = createRequest(
      { messages: [{ role: 'user', content: 'hi' }] },
      { origin: 'https://example.com' }
    )
    const res = await POST(req, { params })
    expect(res.status).toBe(200)
  })
})

describe('OPTIONS /api/chat/[chatbotId]', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})
