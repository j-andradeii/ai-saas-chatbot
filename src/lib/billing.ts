/**
 * Platform currency. Everything that renders money goes through `formatMoney`
 * so the symbol, locale and grouping live in exactly one place.
 */
export const CURRENCY = 'PHP' as const
export const CURRENCY_LOCALE = 'en-PH' as const

/**
 * Plan pricing in Philippine pesos. Yearly keeps the "pay for 10 months, get
 * 12" ratio the previous pricing used.
 */
export const PLAN_PRICING = {
  pro: { monthly: 500, yearly: 5000 },
  enterprise: { monthly: 2000, yearly: 20000 },
} as const

export const PLAN_LIMITS = {
  free: { messages: 500, chatbots: 1 },
  pro: { messages: 5000, chatbots: 5 },
  enterprise: { messages: 50000, chatbots: 20 },
} as const

export type PlanName = keyof typeof PLAN_LIMITS
export type PaidPlan = keyof typeof PLAN_PRICING
export type BillingCycle = 'monthly' | 'yearly'

export function getPlanAmount(plan: PaidPlan, cycle: BillingCycle): number {
  return PLAN_PRICING[plan][cycle]
}

const wholeMoney = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const fractionalMoney = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Render an amount as pesos: 500 -> "₱500", 1234.5 -> "₱1,234.50".
 * Whole amounts drop the centavos; anything with a fraction keeps both digits
 * so a stored payment total is never displayed as "1,234.5".
 */
export function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return formatMoney(0)
  return Number.isInteger(amount)
    ? wholeMoney.format(amount)
    : fractionalMoney.format(amount)
}

export function getBillingPeriodEnd(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start)
  if (cycle === 'monthly') {
    end.setDate(end.getDate() + 30)
  } else {
    end.setDate(end.getDate() + 365)
  }
  return end
}

export function isBillingExpired(
  billingPeriodStart: string | null,
  billingCycle: BillingCycle
): boolean {
  if (!billingPeriodStart) return false
  const start = new Date(billingPeriodStart)
  const end = getBillingPeriodEnd(start, billingCycle)
  return new Date() > end
}
