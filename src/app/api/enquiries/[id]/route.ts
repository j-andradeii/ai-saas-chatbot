import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOwnedEnquiry } from '@/lib/enquiry-access'
import { formatCurrency, getPriority, getStageLabel } from '@/lib/funnel'
import type { EnquiryActivityType } from '@/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enquiry = await getOwnedEnquiry(supabase, id, user.id)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  return NextResponse.json(enquiry)
}

const updateEnquirySchema = z.object({
  is_read: z.boolean().optional(),
  pipeline_stage: z
    .enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  deal_value: z.number().min(0).max(1_000_000_000).nullable().optional(),
  next_action_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
    .nullable()
    .optional(),
  lost_reason: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(50).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getOwnedEnquiry(supabase, id, user.id)
  if (!existing) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateEnquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const input = parsed.data

  // Build the update payload from the provided fields only, recording an
  // activity-log entry for each meaningful change.
  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}
  const activities: Array<{
    type: EnquiryActivityType
    content: string
    metadata: Record<string, unknown>
  }> = []

  if (input.is_read !== undefined) update.is_read = input.is_read

  if (input.pipeline_stage !== undefined && input.pipeline_stage !== existing.pipeline_stage) {
    update.pipeline_stage = input.pipeline_stage
    update.stage_changed_at = now
    activities.push({
      type: 'stage_change',
      content: `Stage changed from ${getStageLabel(existing.pipeline_stage)} to ${getStageLabel(input.pipeline_stage)}`,
      metadata: { from: existing.pipeline_stage, to: input.pipeline_stage },
    })
    // Reopening a closed-lost lead clears the stale lost reason.
    if (input.pipeline_stage !== 'lost' && existing.lost_reason && input.lost_reason === undefined) {
      update.lost_reason = null
    }
  }

  if (input.priority !== undefined && input.priority !== existing.priority) {
    update.priority = input.priority
    activities.push({
      type: 'priority_change',
      content: `Priority changed from ${getPriority(existing.priority).label} to ${getPriority(input.priority).label}`,
      metadata: { from: existing.priority, to: input.priority },
    })
  }

  if (input.deal_value !== undefined && input.deal_value !== existing.deal_value) {
    update.deal_value = input.deal_value
    activities.push({
      type: 'value_change',
      content:
        input.deal_value === null
          ? 'Deal value cleared'
          : `Deal value set to ${formatCurrency(input.deal_value)}`,
      metadata: { from: existing.deal_value, to: input.deal_value },
    })
  }

  if (input.next_action_at !== undefined) {
    update.next_action_at = input.next_action_at
    activities.push({
      type: 'next_action',
      content: input.next_action_at ? 'Follow-up scheduled' : 'Follow-up cleared',
      metadata: { next_action_at: input.next_action_at },
    })
  }

  if (input.lost_reason !== undefined) update.lost_reason = input.lost_reason

  if (input.tags !== undefined) update.tags = input.tags

  if (Object.keys(update).length === 0) {
    return NextResponse.json(existing)
  }

  const { data: enquiry, error } = await supabase
    .from('enquiries')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (activities.length > 0) {
    await supabase.from('enquiry_activities').insert(
      activities.map((a) => ({
        enquiry_id: id,
        type: a.type,
        content: a.content,
        metadata: a.metadata,
        created_by: user.id,
      })),
    )
  }

  return NextResponse.json(enquiry)
}
