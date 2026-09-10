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

import { PATCH } from './route'
import { PLAN_LIMITS } from '@/lib/billing'

function setupAdmin() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'admin-1' } },
    error: null,
  })
  mockSelectProfile.mockResolvedValue({
    data: { role: 'admin' },
    error: null,
  })
}

function setupNonAdmin() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  })
  mockSelectProfile.mockResolvedValue({
    data: { role: 'user' },
    error: null,
  })
}

function makePatchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/admin/payments/pay-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id = 'pay-1') {
  return { params: Promise.resolve({ id }) }
}

const pendingPayment = {
  id: 'pay-1',
  user_id: 'user-1',
  plan_requested: 'pro',
  billing_cycle: 'monthly',
  amount: 29,
  status: 'pending',
  created_at: '2026-03-01T00:00:00Z',
}

describe('PATCH /api/admin/payments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approve updates payment status + user plan + message_limit', async () => {
    setupAdmin()

    const mockProfileUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    const mockPaymentUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...pendingPayment, status: 'approved' },
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...pendingPayment },
                error: null,
              }),
            }),
          }),
          update: mockPaymentUpdate,
        }
      }
      if (table === 'profiles') {
        return { update: mockProfileUpdate }
      }
      return {}
    })

    const res = await PATCH(
      makePatchRequest({ status: 'approved' }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('approved')

    // Verify profiles.update was called with correct plan fields
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'pro',
        message_limit: PLAN_LIMITS.pro.messages,
        billing_cycle: 'monthly',
        message_count: 0,
      })
    )
  })

  it('approve sets period_start/period_end correctly for monthly', async () => {
    setupAdmin()

    let capturedPaymentUpdateArgs: Record<string, unknown> | null = null

    const mockPaymentUpdate = vi.fn().mockImplementation((data) => {
      capturedPaymentUpdateArgs = data
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...pendingPayment, status: 'approved', ...data },
              error: null,
            }),
          }),
        }),
      }
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...pendingPayment, billing_cycle: 'monthly' },
                error: null,
              }),
            }),
          }),
          update: mockPaymentUpdate,
        }
      }
      if (table === 'profiles') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    const res = await PATCH(
      makePatchRequest({ status: 'approved' }),
      makeParams()
    )

    expect(res.status).toBe(200)
    expect(capturedPaymentUpdateArgs).not.toBeNull()

    const periodStart = new Date(
      capturedPaymentUpdateArgs!.period_start as string
    )
    const periodEnd = new Date(capturedPaymentUpdateArgs!.period_end as string)
    const diffDays = Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    expect(diffDays).toBe(30)
  })

  it('approve sets period_start/period_end correctly for yearly', async () => {
    setupAdmin()

    let capturedPaymentUpdateArgs: Record<string, unknown> | null = null

    const mockPaymentUpdate = vi.fn().mockImplementation((data) => {
      capturedPaymentUpdateArgs = data
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                ...pendingPayment,
                billing_cycle: 'yearly',
                status: 'approved',
                ...data,
              },
              error: null,
            }),
          }),
        }),
      }
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...pendingPayment, billing_cycle: 'yearly' },
                error: null,
              }),
            }),
          }),
          update: mockPaymentUpdate,
        }
      }
      if (table === 'profiles') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      return {}
    })

    const res = await PATCH(
      makePatchRequest({ status: 'approved' }),
      makeParams()
    )

    expect(res.status).toBe(200)
    expect(capturedPaymentUpdateArgs).not.toBeNull()

    const periodStart = new Date(
      capturedPaymentUpdateArgs!.period_start as string
    )
    const periodEnd = new Date(capturedPaymentUpdateArgs!.period_end as string)
    const diffDays = Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    expect(diffDays).toBe(365)
  })

  it('reject updates payment status but NOT user plan', async () => {
    setupAdmin()

    const mockProfileUpdate = vi.fn()

    const mockPaymentUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...pendingPayment, status: 'rejected' },
            error: null,
          }),
        }),
      }),
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...pendingPayment },
                error: null,
              }),
            }),
          }),
          update: mockPaymentUpdate,
        }
      }
      if (table === 'profiles') {
        return { update: mockProfileUpdate }
      }
      return {}
    })

    const res = await PATCH(
      makePatchRequest({ status: 'rejected', admin_notes: 'Invalid proof' }),
      makeParams()
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('rejected')

    // profiles.update should NOT have been called
    expect(mockProfileUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 if payment is already reviewed (not pending)', async () => {
    setupAdmin()

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...pendingPayment, status: 'approved' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await PATCH(
      makePatchRequest({ status: 'approved' }),
      makeParams()
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/already been reviewed/i)
  })

  it('returns 403 for non-admin user', async () => {
    setupNonAdmin()

    const res = await PATCH(
      makePatchRequest({ status: 'approved' }),
      makeParams()
    )

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Forbidden')
  })
})
