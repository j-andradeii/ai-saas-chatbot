import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr
const mockGetUser = vi.fn()
const mockSingle = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}))

// Import after mocks
import { proxy, config } from './proxy'

function createRequest(
  url: string,
  options?: { method?: string; cookies?: Record<string, string> }
): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options?.method ?? 'GET',
  })
  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value)
    }
  }
  return req
}

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('redirects unauthenticated user from /dashboard to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const response = await proxy(createRequest('http://localhost:3000/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('redirects unauthenticated user from /chatbots to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const response = await proxy(createRequest('http://localhost:3000/chatbots'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('includes next param in redirect URL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const response = await proxy(createRequest('http://localhost:3000/dashboard'))
    const location = response.headers.get('location')!
    expect(location).toContain('next=%2Fdashboard')
  })

  it('redirects authenticated user from /login to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const response = await proxy(createRequest('http://localhost:3000/login'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard')
  })

  it('allows authenticated user to access /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const response = await proxy(createRequest('http://localhost:3000/dashboard'))
    expect(response.status).toBe(200)
  })

  it('allows unauthenticated user to access public routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const response = await proxy(createRequest('http://localhost:3000/'))
    expect(response.status).toBe(200)
  })

  it('exports a matcher config', () => {
    expect(config.matcher).toBeDefined()
    expect(typeof config.matcher).toBe('string')
  })

  // Admin guard tests
  it('redirects non-admin user from /admin to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'user' } })
    const response = await proxy(createRequest('http://localhost:3000/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard')
  })

  it('redirects user with no profile from /admin to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null })
    const response = await proxy(createRequest('http://localhost:3000/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard')
  })

  it('allows admin user to access /admin routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    const response = await proxy(createRequest('http://localhost:3000/admin'))
    expect(response.status).toBe(200)
  })

  it('allows admin user to access /api/admin routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    const response = await proxy(createRequest('http://localhost:3000/api/admin/users'))
    expect(response.status).toBe(200)
  })

  // Impersonation mutation-blocking tests
  it('blocks POST during impersonation on non-admin routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const response = await proxy(
      createRequest('http://localhost:3000/api/chatbots', {
        method: 'POST',
        cookies: { 'x-impersonate-user-id': 'target-user' },
      })
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('read-only')
  })

  it('blocks DELETE during impersonation on non-admin routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const response = await proxy(
      createRequest('http://localhost:3000/api/chatbots/123', {
        method: 'DELETE',
        cookies: { 'x-impersonate-user-id': 'target-user' },
      })
    )
    expect(response.status).toBe(403)
  })

  it('allows GET during impersonation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const response = await proxy(
      createRequest('http://localhost:3000/dashboard', {
        cookies: { 'x-impersonate-user-id': 'target-user' },
      })
    )
    expect(response.status).toBe(200)
  })

  it('allows mutations on admin routes during impersonation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    const response = await proxy(
      createRequest('http://localhost:3000/api/admin/impersonate', {
        method: 'DELETE',
        cookies: { 'x-impersonate-user-id': 'target-user' },
      })
    )
    expect(response.status).toBe(200)
  })
})
