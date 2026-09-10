import { describe, it, expect, vi, beforeEach } from 'vitest'

// Build a chainable query builder mock
const mockUpdate = vi.fn()
const mockNeq = vi.fn()
const mockSelect = vi.fn()
const mockEqAfterUpdate = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}))

import { GET } from './route'
import { PLAN_LIMITS } from '@/lib/billing'

function createRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/cron/check-billing', {
    method: 'GET',
    headers,
  })
}

describe('GET /api/cron/check-billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'

    // Default: select chain returns empty array
    mockSelect.mockReturnValue({
      neq: mockNeq,
    })
    mockNeq.mockResolvedValue({ data: [], error: null })

    // Update chain
    mockUpdate.mockReturnValue({
      eq: mockEqAfterUpdate,
    })
    mockEqAfterUpdate.mockResolvedValue({ error: null })
  })

  it('returns 401 if no authorization header', async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 if wrong authorization header', async () => {
    const res = await GET(createRequest({ authorization: 'Bearer wrong-token' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('downgrades expired profiles to free plan', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))

    const expiredProfile = {
      id: 'user-1',
      plan: 'pro',
      billing_period_start: '2026-01-01T00:00:00Z', // ~89 days ago, monthly expired
      billing_cycle: 'monthly',
    }

    mockNeq.mockResolvedValue({ data: [expiredProfile], error: null })

    const res = await GET(createRequest({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(1)
    expect(body.downgraded).toBe(1)

    // Verify the update was called with correct values
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'free',
      message_limit: PLAN_LIMITS.free.messages,
      message_count: 0,
    })
    expect(mockEqAfterUpdate).toHaveBeenCalledWith('id', 'user-1')

    vi.useRealTimers()
  })

  it('does NOT downgrade profiles still within billing period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))

    const activeProfile = {
      id: 'user-2',
      plan: 'pro',
      billing_period_start: '2026-03-20T00:00:00Z', // 10 days ago, monthly still active
      billing_cycle: 'monthly',
    }

    mockNeq.mockResolvedValue({ data: [activeProfile], error: null })

    const res = await GET(createRequest({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(1)
    expect(body.downgraded).toBe(0)

    // Update should NOT have been called
    expect(mockUpdate).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('returns count of checked and downgraded profiles', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))

    const profiles = [
      {
        id: 'user-expired-1',
        plan: 'pro',
        billing_period_start: '2026-01-01T00:00:00Z',
        billing_cycle: 'monthly',
      },
      {
        id: 'user-active',
        plan: 'enterprise',
        billing_period_start: '2026-03-25T00:00:00Z',
        billing_cycle: 'monthly',
      },
      {
        id: 'user-expired-2',
        plan: 'enterprise',
        billing_period_start: '2025-12-01T00:00:00Z',
        billing_cycle: 'monthly',
      },
    ]

    mockNeq.mockResolvedValue({ data: profiles, error: null })

    const res = await GET(createRequest({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.checked).toBe(3)
    expect(body.downgraded).toBe(2)
    expect(body.timestamp).toBeDefined()

    vi.useRealTimers()
  })
})
