import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockSelectProfile = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => mockSelectProfile(),
        }),
      }),
    }),
  }),
}))

const mockAdminFrom = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
  },
}))

import { GET, PATCH } from './route'

describe('Admin Providers API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupAdmin() {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockSelectProfile.mockResolvedValue({ data: { role: 'admin' }, error: null })
  }

  function setupNonAdmin() {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockSelectProfile.mockResolvedValue({ data: { role: 'user' }, error: null })
  }

  it('GET returns all providers for admin user', async () => {
    setupAdmin()
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'p-1',
              name: 'openai',
              display_name: 'OpenAI',
              platform_api_key: 'sk-abcdef1234567890',
              is_enabled: true,
              llm_provider_models: [{ id: 'm-1', name: 'gpt-4o' }],
            },
          ],
          error: null,
        }),
      }),
    })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].name).toBe('openai')
    // API key should be masked
    expect(data[0].platform_api_key).toBe('****7890')
  })

  it('PATCH updates provider API key and enabled status', async () => {
    setupAdmin()
    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'p-1',
                name: 'openai',
                platform_api_key: 'sk-newkey1234',
                is_enabled: false,
                llm_provider_models: [],
              },
              error: null,
            }),
          }),
        }),
      }),
    })

    const req = new Request('http://localhost:3000/api/admin/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'p-1', platform_api_key: 'sk-newkey1234', is_enabled: false }),
    })

    const res = await PATCH(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.platform_api_key).toBe('****1234')
  })

  it('non-admin user gets 403', async () => {
    setupNonAdmin()

    const res = await GET()
    expect(res.status).toBe(403)
  })
})
