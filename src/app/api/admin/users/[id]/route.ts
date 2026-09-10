import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

const updateUserSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  message_limit: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get user's chatbots with conversation counts
  const { data: chatbots } = await supabaseAdmin
    .from('chatbots')
    .select('id, name, domain, llm_model, active, created_at, conversations(count)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  const formattedChatbots = (chatbots ?? []).map((c) => ({
    ...c,
    conversation_count: c.conversations?.[0]?.count ?? 0,
    conversations: undefined,
  }))

  return NextResponse.json({ ...profile, chatbots: formattedChatbots })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data: updated, error } = await supabaseAdmin
    .from('profiles')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
