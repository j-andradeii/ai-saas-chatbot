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

const createFormSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case'),
  display_name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  fields: z.array(fieldSchema).min(1),
  webhook_url: z.string().url().optional().or(z.literal('')),
  success_message: z.string().max(500).optional(),
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

  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!chatbot || chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: forms, error } = await supabase
    .from('enquiry_forms')
    .select('*')
    .eq('chatbot_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(forms)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const parsed = createFormSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: form, error } = await supabase
    .from('enquiry_forms')
    .insert({
      chatbot_id: id,
      name: parsed.data.name,
      display_name: parsed.data.display_name,
      description: parsed.data.description,
      fields: parsed.data.fields,
      webhook_url: parsed.data.webhook_url || null,
      success_message: parsed.data.success_message || 'Thank you! Your enquiry has been submitted.',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(form, { status: 201 })
}
