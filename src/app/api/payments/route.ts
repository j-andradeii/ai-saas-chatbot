import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_PRICING, CURRENCY, type PaidPlan, type BillingCycle } from '@/lib/billing'

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: payments, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const planRequested = formData.get('plan_requested') as string | null
  const billingCycle = formData.get('billing_cycle') as string | null
  const referenceNumber = formData.get('reference_number') as string | null
  const proofFile = formData.get('proof_file') as File | null

  // Validate plan
  if (!planRequested || !['pro', 'enterprise'].includes(planRequested)) {
    return NextResponse.json(
      { error: 'Invalid plan. Must be "pro" or "enterprise".' },
      { status: 400 }
    )
  }

  // Validate billing cycle
  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    return NextResponse.json(
      { error: 'Invalid billing cycle. Must be "monthly" or "yearly".' },
      { status: 400 }
    )
  }

  // Validate proof file
  if (!proofFile) {
    return NextResponse.json(
      { error: 'Payment proof file is required.' },
      { status: 400 }
    )
  }

  if (!ALLOWED_MIME_TYPES.includes(proofFile.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPG, WEBP, PDF.' },
      { status: 400 }
    )
  }

  if (proofFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 5MB.' },
      { status: 400 }
    )
  }

  // Upload proof to storage
  const timestamp = Date.now()
  const storagePath = `${user.id}/${timestamp}_${proofFile.name}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('payment-proofs')
    .upload(storagePath, proofFile, {
      contentType: proofFile.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Calculate amount
  const amount = PLAN_PRICING[planRequested as PaidPlan][billingCycle as BillingCycle]

  // Insert payment record
  const { data: payment, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: user.id,
      amount,
      currency: CURRENCY,
      plan_requested: planRequested,
      billing_cycle: billingCycle,
      proof_url: storagePath,
      proof_file_name: proofFile.name,
      reference_number: referenceNumber || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !payment) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create payment record' },
      { status: 500 }
    )
  }

  return NextResponse.json(payment, { status: 201 })
}
