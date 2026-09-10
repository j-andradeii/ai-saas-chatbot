import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSupabaseAdmin, mockCreateClient } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return {
    mockSupabaseAdmin: { from: mockFrom },
    mockCreateClient: vi.fn(),
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { GET } from './route'

function buildAdminSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    }),
  }
}

function buildNonAdminSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'user' },
            error: null,
          }),
        }),
      }),
    }),
  }
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all users for admin', async () => {
    mockCreateClient.mockResolvedValue(buildAdminSupabase())

    const users = [
      { id: 'u1', full_name: 'Alice', email: 'alice@test.com', plan: 'free', chatbots: [{ count: 2 }] },
      { id: 'u2', full_name: 'Bob', email: 'bob@test.com', plan: 'pro', chatbots: [{ count: 0 }] },
    ]

    mockSupabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: users, error: null }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].chatbot_count).toBe(2)
    expect(data[1].chatbot_count).toBe(0)
  })

  it('returns 403 for non-admin', async () => {
    mockCreateClient.mockResolvedValue(buildNonAdminSupabase())

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
    })

    const res = await GET()
    expect(res.status).toBe(403)
  })
})
