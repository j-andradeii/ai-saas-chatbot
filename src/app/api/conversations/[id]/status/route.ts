import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['active', 'resolved', 'archived'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse and validate body
  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch conversation and verify ownership
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*, chatbots(user_id)')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  if (conversation.chatbots?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Update status
  const { data: updated, error: updateError } = await supabase
    .from('conversations')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, chatbots(name)')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
