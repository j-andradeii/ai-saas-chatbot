import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  PLAN_LIMITS,
  getBillingPeriodEnd,
  type PaidPlan,
  type BillingCycle,
} from '@/lib/billing'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: { status: string; admin_notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json(
      { error: 'Status must be "approved" or "rejected".' },
      { status: 400 }
    )
  }

  // Fetch the payment
  const { data: payment, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (payment.status !== 'pending') {
    return NextResponse.json(
      { error: 'Payment has already been reviewed.' },
      { status: 400 }
    )
  }

  const now = new Date()

  if (body.status === 'approved') {
    const periodStart = now
    const periodEnd = getBillingPeriodEnd(
      periodStart,
      payment.billing_cycle as BillingCycle
    )
    const plan = payment.plan_requested as PaidPlan

    // Update payment record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'approved',
        reviewed_by: admin.id,
        reviewed_at: now.toISOString(),
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        admin_notes: body.admin_notes || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Upgrade user's plan
    await supabaseAdmin
      .from('profiles')
      .update({
        plan,
        message_limit: PLAN_LIMITS[plan].messages,
        billing_cycle: payment.billing_cycle,
        billing_period_start: periodStart.toISOString(),
        message_count: 0,
      })
      .eq('id', payment.user_id)

    return NextResponse.json(updated)
  }

  // Rejected
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'rejected',
      reviewed_by: admin.id,
      reviewed_at: now.toISOString(),
      admin_notes: body.admin_notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
