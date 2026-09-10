import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'email', 'phone', 'number', 'textarea', 'select', 'date']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
})

const updateFormSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/).optional(),
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  fields: z.array(fieldSchema).min(1).optional(),
  webhook_url: z.string().url().optional().or(z.literal('')).or(z.null()),
  success_message: z.string().max(500).optional(),
  is_enabled: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; formId: string }> }
) {
  const { id, formId } = await params
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

  const parsed = updateFormSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const updateData = { ...parsed.data }
  if (updateData.webhook_url === '') updateData.webhook_url = null

  const { data: form, error } = await supabase
    .from('enquiry_forms')
    .update(updateData)
    .eq('id', formId)
    .eq('chatbot_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(form)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; formId: string }> }
) {
  const { id, formId } = await params
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
    .from('enquiry_forms')
    .delete()
    .eq('id', formId)
    .eq('chatbot_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
