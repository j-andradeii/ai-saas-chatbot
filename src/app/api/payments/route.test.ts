import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}))

import { GET, POST } from './route'

function buildFormData(fields: Record<string, string | Blob>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

function makeProofFile(name = 'receipt.png', type = 'image/png', size = 1024) {
  const content = new Uint8Array(size)
  return new File([content], name, { type })
}

describe('GET /api/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only the current user\'s payments', async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })

    const payments = [
      { id: 'pay-1', user_id: 'user-1', amount: 500, status: 'pending' },
      { id: 'pay-2', user_id: 'user-1', amount: 5000, status: 'approved' },
    ]

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: payments, error: null }),
        }),
      }),
    })

    const res = await GET()
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual(payments)
    expect(body).toHaveLength(2)

    // Verify the query was scoped to user-1
    expect(mockAdminFrom).toHaveBeenCalledWith('payments')
    const selectFn = mockAdminFrom.mock.results[0].value.select
    expect(selectFn).toHaveBeenCalledWith('*')
    const eqFn = selectFn.mock.results[0].value.eq
    expect(eqFn).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

describe('POST /api/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockReturnValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
  })

  it('creates payment with correct amount for pro/monthly', async () => {
    // Mock storage upload success
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    })

    const insertedPayment = {
      id: 'pay-1',
      user_id: 'user-1',
      amount: 500,
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      proof_url: expect.stringContaining('user-1/'),
      proof_file_name: 'receipt.png',
      reference_number: 'REF-123',
      status: 'pending',
    }

    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedPayment, error: null }),
        }),
      }),
    })

    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      proof_file: makeProofFile(),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.amount).toBe(500)
    expect(body.plan_requested).toBe('pro')
    expect(body.billing_cycle).toBe('monthly')
    expect(body.status).toBe('pending')

    // Verify insert was called with amount 500 (from real PLAN_PRICING)
    expect(mockAdminFrom).toHaveBeenCalledWith('payments')
    const insertFn = mockAdminFrom.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        amount: 500,
        plan_requested: 'pro',
        billing_cycle: 'monthly',
        status: 'pending',
      })
    )

    // Verify storage upload was called
    expect(mockStorageFrom).toHaveBeenCalledWith('payment-proofs')
  })

  it('returns 400 for invalid plan_requested', async () => {
    const formData = buildFormData({
      plan_requested: 'invalid',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      proof_file: makeProofFile(),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('Invalid plan')
  })

  it('returns 400 for missing proof file', async () => {
    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      // no proof_file
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('proof file is required')
  })

  it('returns 401 for unauthenticated user', async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    })

    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      proof_file: makeProofFile(),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid billing cycle', async () => {
    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'weekly',
      reference_number: 'REF-123',
      proof_file: makeProofFile(),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('Invalid billing cycle')
  })

  it('returns 400 for invalid file type', async () => {
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    })

    const badFile = new File([new Uint8Array(100)], 'script.js', {
      type: 'application/javascript',
    })

    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      proof_file: badFile,
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain('Invalid file type')
  })

  it('returns 500 when storage upload fails', async () => {
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        error: { message: 'Storage quota exceeded' },
      }),
    })

    const formData = buildFormData({
      plan_requested: 'pro',
      billing_cycle: 'monthly',
      reference_number: 'REF-123',
      proof_file: makeProofFile(),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.error).toContain('Upload failed')
    expect(body.error).toContain('Storage quota exceeded')
  })

  it('creates payment with correct amount for enterprise/yearly', async () => {
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    })

    const insertedPayment = {
      id: 'pay-2',
      user_id: 'user-1',
      amount: 20000,
      plan_requested: 'enterprise',
      billing_cycle: 'yearly',
      status: 'pending',
    }

    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertedPayment, error: null }),
        }),
      }),
    })

    const formData = buildFormData({
      plan_requested: 'enterprise',
      billing_cycle: 'yearly',
      reference_number: '',
      proof_file: makeProofFile('invoice.pdf', 'application/pdf'),
    })

    const req = new Request('http://localhost:3000/api/payments', {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.amount).toBe(20000)

    // Verify insert was called with amount 20000 (from real PLAN_PRICING)
    const insertFn = mockAdminFrom.mock.results[0].value.insert
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 20000,
        plan_requested: 'enterprise',
        billing_cycle: 'yearly',
      })
    )
  })
})
