import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

import { GET, POST } from './route'

// Helper to build chainable supabase query mock
function chainMock(resolvedValue: unknown) {
  const mock: Record<string, unknown> = {}
  const handler = () =>
    new Proxy(mock, {
      get: (_target, prop) => {
        if (prop === 'then') return undefined // not a thenable
        return vi.fn((..._args: unknown[]) => {
          // Terminal methods resolve the value
          if (['single', 'maybeSingle'].includes(prop as string)) {
            return Promise.resolve(resolvedValue)
          }
          // For head: true count queries, resolve immediately from order/eq
          if (
            prop === 'eq' &&
            resolvedValue &&
            typeof resolvedValue === 'object' &&
            'count' in (resolvedValue as Record<string, unknown>)
          ) {
            return Promise.resolve(resolvedValue)
          }
          return handler()
        })
      },
    })
  return handler()
}

describe('GET /api/chatbots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns chatbots for authenticated user', async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    const chatbots = [{ id: 'cb-1', name: 'Test Bot', domain: 'test.com' }]
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: chatbots, error: null }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(chatbots)
  })

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })
})

describe('POST /api/chatbots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReturnValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  function setupMocks(opts: { plan?: string; count?: number; insertResult?: unknown }) {
    const { plan = 'free', count = 0, insertResult } = opts
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chainMock({ data: { plan }, error: null })
      }
      if (table === 'chatbots') {
        // The first call is the count query (select with head: true)
        // Subsequent calls are inserts
        // We distinguish by checking if it's a count query or insert
        const mock: Record<string, unknown> = {}
        return new Proxy(mock, {
          get: (_target, prop) => {
            if (prop === 'then') return undefined
            if (prop === 'select') {
              return vi.fn((_sel: string, opts?: { count?: string; head?: boolean }) => {
                if (opts?.head) {
                  // count query
                  return chainMock({ count, error: null })
                }
                // regular select after insert — shouldn't happen at this level
                return chainMock(insertResult ?? { data: null, error: null })
              })
            }
            if (prop === 'insert') {
              return vi.fn(() => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue(insertResult ?? { data: null, error: null }),
                }),
              }))
            }
            return vi.fn(() => new Proxy(mock, { get: (_t, p) => {
              if (p === 'then') return undefined
              return vi.fn()
            }}))
          },
        })
      }
      return chainMock({ data: null, error: null })
    })
  }

  it('creates a chatbot with valid data (under limit)', async () => {
    const newChatbot = { id: 'cb-2', name: 'New Bot', domain: 'new.com', user_id: 'user-1' }
    setupMocks({
      plan: 'free',
      count: 0,
      insertResult: { data: newChatbot, error: null },
    })

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Bot', domain: 'new.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('New Bot')
  })

  it('returns 402 when chatbot limit reached on free plan', async () => {
    setupMocks({ plan: 'free', count: 1 }) // free = 1 chatbot limit

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Over Limit Bot', domain: 'test.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.plan).toBe('free')
    expect(body.limit).toBe(1)
    expect(body.current).toBe(1)
    expect(body.error).toContain('chatbot limit')
  })

  it('allows pro plan to create up to 5 chatbots', async () => {
    const newChatbot = { id: 'cb-3', name: 'Pro Bot', domain: 'pro.com', user_id: 'user-1' }
    setupMocks({
      plan: 'pro',
      count: 4, // still under pro limit of 5
      insertResult: { data: newChatbot, error: null },
    })

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Pro Bot', domain: 'pro.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 402 when pro plan chatbot limit reached', async () => {
    setupMocks({ plan: 'pro', count: 5 }) // pro = 5 chatbot limit

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Over Pro Bot', domain: 'test.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.plan).toBe('pro')
    expect(body.limit).toBe(5)
  })

  it('returns 400 for invalid data', async () => {
    setupMocks({ plan: 'free', count: 0 })

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', domain: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const req = new Request('http://localhost:3000/api/chatbots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', domain: 'test.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
