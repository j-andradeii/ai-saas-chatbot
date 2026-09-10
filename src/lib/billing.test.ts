import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getPlanAmount,
  getBillingPeriodEnd,
  isBillingExpired,
  formatMoney,
  CURRENCY,
  PLAN_LIMITS,
} from './billing'

describe('PLAN_LIMITS', () => {
  it('gives the free plan 500 messages and 1 chatbot', () => {
    expect(PLAN_LIMITS.free).toEqual({ messages: 500, chatbots: 1 })
  })

  it('increases both allowances with every paid tier', () => {
    expect(PLAN_LIMITS.pro.messages).toBeGreaterThan(PLAN_LIMITS.free.messages)
    expect(PLAN_LIMITS.enterprise.messages).toBeGreaterThan(PLAN_LIMITS.pro.messages)
    expect(PLAN_LIMITS.pro.chatbots).toBeGreaterThan(PLAN_LIMITS.free.chatbots)
    expect(PLAN_LIMITS.enterprise.chatbots).toBeGreaterThan(PLAN_LIMITS.pro.chatbots)
  })
})

describe('getPlanAmount', () => {
  it('returns 500 for pro monthly', () => {
    expect(getPlanAmount('pro', 'monthly')).toBe(500)
  })

  it('returns 5000 for pro yearly', () => {
    expect(getPlanAmount('pro', 'yearly')).toBe(5000)
  })

  it('returns 2000 for enterprise monthly', () => {
    expect(getPlanAmount('enterprise', 'monthly')).toBe(2000)
  })

  it('returns 20000 for enterprise yearly', () => {
    expect(getPlanAmount('enterprise', 'yearly')).toBe(20000)
  })

  it('prices yearly at ten months of the monthly rate', () => {
    expect(getPlanAmount('pro', 'yearly')).toBe(getPlanAmount('pro', 'monthly') * 10)
    expect(getPlanAmount('enterprise', 'yearly')).toBe(
      getPlanAmount('enterprise', 'monthly') * 10
    )
  })
})

describe('formatMoney', () => {
  it('uses Philippine pesos', () => {
    expect(CURRENCY).toBe('PHP')
    expect(formatMoney(500)).toContain('500')
    expect(formatMoney(500)).toMatch(/[₱P]/)
  })

  it('drops centavos on whole amounts', () => {
    expect(formatMoney(2000)).not.toContain('.')
  })

  it('always shows two decimals on fractional amounts', () => {
    expect(formatMoney(1234.5)).toContain('1,234.50')
  })

  it('groups thousands', () => {
    expect(formatMoney(20000)).toContain('20,000')
  })

  it('falls back to zero for non-finite input', () => {
    expect(formatMoney(Number.NaN)).toBe(formatMoney(0))
  })
})

describe('getBillingPeriodEnd', () => {
  it('adds 30 days for monthly cycle', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = getBillingPeriodEnd(start, 'monthly')
    expect(end.toISOString()).toBe('2026-01-31T00:00:00.000Z')
  })

  it('adds 365 days for yearly cycle', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = getBillingPeriodEnd(start, 'yearly')
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('does not mutate the original start date', () => {
    const start = new Date('2026-03-15T00:00:00Z')
    const originalTime = start.getTime()
    getBillingPeriodEnd(start, 'monthly')
    expect(start.getTime()).toBe(originalTime)
  })
})

describe('isBillingExpired', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns true when billing period has expired', () => {
    vi.useFakeTimers()
    // Set "now" to 2026-03-30
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))

    // Start was 60 days ago — monthly period (30 days) is long past
    const result = isBillingExpired('2026-01-29T00:00:00Z', 'monthly')
    expect(result).toBe(true)
  })

  it('returns false when billing period is still active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))

    // Start was 10 days ago — monthly period still active
    const result = isBillingExpired('2026-03-20T00:00:00Z', 'monthly')
    expect(result).toBe(false)
  })

  it('returns false when billingPeriodStart is null', () => {
    const result = isBillingExpired(null, 'monthly')
    expect(result).toBe(false)
  })
})
