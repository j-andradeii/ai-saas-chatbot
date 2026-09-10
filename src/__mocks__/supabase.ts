import { vi } from 'vitest'

interface MockQueryResult {
  data: unknown
  error: null | { message: string }
  count: number | null
}

/**
 * Chainable Supabase mock factory.
 * Usage:
 *   const { client, query } = createMockSupabaseClient()
 *   query.mockResolvedValue({ data: [...], error: null, count: null })
 */
export function createMockSupabaseClient() {
  const query = vi.fn<() => Promise<MockQueryResult>>().mockResolvedValue({
    data: null,
    error: null,
    count: null,
  })

  const chainable = {
    from: vi.fn(() => chainable),
    select: vi.fn(() => chainable),
    insert: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    upsert: vi.fn(() => chainable),
    delete: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    neq: vi.fn(() => chainable),
    gt: vi.fn(() => chainable),
    gte: vi.fn(() => chainable),
    lt: vi.fn(() => chainable),
    lte: vi.fn(() => chainable),
    like: vi.fn(() => chainable),
    ilike: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    is: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    range: vi.fn(() => chainable),
    single: vi.fn(() => query()),
    maybeSingle: vi.fn(() => query()),
    then: vi.fn((resolve: (value: MockQueryResult) => void) => query().then(resolve)),
    rpc: vi.fn(() => query()),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.supabase.co/storage/test' } })),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }

  return {
    client: chainable,
    /** Mock the resolved value for terminal query operations (single, maybeSingle, rpc, then) */
    query,
  }
}
