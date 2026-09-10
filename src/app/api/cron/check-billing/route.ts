import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_LIMITS, getBillingPeriodEnd, type BillingCycle } from '@/lib/billing'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Fetch all paid profiles
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, plan, billing_period_start, billing_cycle')
    .neq('plan', 'free')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let downgraded = 0

  for (const profile of profiles ?? []) {
    if (!profile.billing_period_start) continue

    const periodEnd = getBillingPeriodEnd(
      new Date(profile.billing_period_start),
      profile.billing_cycle as BillingCycle
    )

    if (now > periodEnd) {
      await supabaseAdmin
        .from('profiles')
        .update({
          plan: 'free',
          message_limit: PLAN_LIMITS.free.messages,
          message_count: 0,
        })
        .eq('id', profile.id)

      downgraded++
    }
  }

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    downgraded,
    timestamp: now.toISOString(),
  })
}
