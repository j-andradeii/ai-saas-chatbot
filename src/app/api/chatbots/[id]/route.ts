import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateChatbotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().min(1).max(255).optional(),
  personality_prompt: z.string().max(5000).optional(),
  welcome_message: z.string().max(500).optional(),
  skills: z.array(z.string()).optional(),
  quick_actions: z
    .array(
      z.object({
        label: z.string(),
        icon: z.string().optional(),
        prompt: z.string(),
      })
    )
    .optional(),
  llm_provider: z.string().optional(),
  llm_model: z.string().optional(),
  api_key: z.string().optional(),
  primary_color: z.string().optional(),
  widget_position: z.enum(['bottom-right', 'bottom-left']).optional(),
  active: z.boolean().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: chatbot, error } = await supabase
    .from('chatbots')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  if (chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(chatbot)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check ownership
  const { data: existing, error: fetchError } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateChatbotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: chatbot, error } = await supabase
    .from('chatbots')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(chatbot)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check ownership
  const { data: existing, error: fetchError } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('chatbots')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
