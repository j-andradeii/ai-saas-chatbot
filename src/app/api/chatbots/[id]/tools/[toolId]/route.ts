import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateToolSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case').optional(),
  description: z.string().min(1).max(500).optional(),
  parameters: z.record(z.string(), z.string()).optional(),
  webhook_url: z.string().url().optional().or(z.literal('')).or(z.null()),
  is_enabled: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!chatbot || chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateToolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updateData = { ...parsed.data }
  if (updateData.webhook_url === '') updateData.webhook_url = null

  const { data: tool, error } = await supabase
    .from('chatbot_tools')
    .update(updateData)
    .eq('id', toolId)
    .eq('chatbot_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(tool)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  const { id, toolId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!chatbot || chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('chatbot_tools')
    .delete()
    .eq('id', toolId)
    .eq('chatbot_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
