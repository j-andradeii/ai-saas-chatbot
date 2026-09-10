import { describe, it, expect, vi } from 'vitest'

// Mock Upstash dependencies — factories must be self-contained (hoisted)
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({})),
  },
}))

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = vi.fn().mockResolvedValue({ success: true })
    static slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
  }
  return { Ratelimit: MockRatelimit }
})

import { chatRatelimit } from './ratelimit'

describe('chatRatelimit', () => {
  it('exports a chatRatelimit instance', () => {
    expect(chatRatelimit).toBeDefined()
  })

  it('has a limit method', () => {
    expect(typeof chatRatelimit.limit).toBe('function')
  })

  it('resolves with success on limit check', async () => {
    const result = await chatRatelimit.limit('test-ip')
    expect(result.success).toBe(true)
  })
})
