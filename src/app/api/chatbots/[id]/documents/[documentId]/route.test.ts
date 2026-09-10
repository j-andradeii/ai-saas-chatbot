import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetUser, mockFrom, mockAdminFrom, mockStorageRemove } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockFrom = vi.fn()
  const mockAdminFrom = vi.fn()
  const mockStorageRemove = vi.fn().mockResolvedValue({ error: null })
  return { mockGetUser, mockFrom, mockAdminFrom, mockStorageRemove }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: (...args: unknown[]) => mockFrom(...args),
    })
  ),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
    storage: {
      from: vi.fn(() => ({
        remove: mockStorageRemove,
      })),
    },
  },
}))

import { DELETE } from './route'

function createParams(id: string, documentId: string) {
  return { params: Promise.resolve({ id, documentId }) }
}

describe('DELETE /api/chatbots/[id]/documents/[documentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'No auth' } })

    const request = new Request('http://localhost/api/chatbots/bot-1/documents/doc-1', { method: 'DELETE' })
    const response = await DELETE(request, createParams('bot-1', 'doc-1'))
    expect(response.status).toBe(401)
  })

  it('returns 403 when user does not own chatbot', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'other-user' },
            error: null,
          }),
        }),
      }),
    })

    const request = new Request('http://localhost/api/chatbots/bot-1/documents/doc-1', { method: 'DELETE' })
    const response = await DELETE(request, createParams('bot-1', 'doc-1'))
    expect(response.status).toBe(403)
  })

  it('returns 404 when document not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const request = new Request('http://localhost/api/chatbots/bot-1/documents/doc-1', { method: 'DELETE' })
    const response = await DELETE(request, createParams('bot-1', 'doc-1'))
    expect(response.status).toBe(404)
  })

  it('returns 500 when delete fails', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { file_url: 'user-1/bot-1/test.txt' },
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      }),
    })

    const request = new Request('http://localhost/api/chatbots/bot-1/documents/doc-1', { method: 'DELETE' })
    const response = await DELETE(request, createParams('bot-1', 'doc-1'))
    expect(response.status).toBe(500)
  })

  it('returns success when document is deleted', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { user_id: 'user-1' },
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { file_url: 'user-1/bot-1/test.txt' },
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const request = new Request('http://localhost/api/chatbots/bot-1/documents/doc-1', { method: 'DELETE' })
    const response = await DELETE(request, createParams('bot-1', 'doc-1'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(mockStorageRemove).toHaveBeenCalledWith(['user-1/bot-1/test.txt'])
  })
})
