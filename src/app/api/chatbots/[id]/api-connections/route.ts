import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  cardDisplayFields,
  ctaTargetIssue,
  ctaFormBelongsToChatbot,
  normaliseCta,
} from '@/lib/api-connection-card'
import { maskHeaders, isMasked } from '@/lib/api-connection-headers'

const parameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().min(1),
  required: z.boolean(),
})

const createConnectionSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case'),
  description: z.string().min(1).max(500),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.string().min(1).max(2000),
  headers: z.record(z.string(), z.string()).optional(),
  request_body_template: z.record(z.string(), z.unknown()).optional().nullable(),
  parameters: z.array(parameterSchema).optional(),
  response_path: z.string().max(200).optional().nullable(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  ...cardDisplayFields,
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

  const { data: connections, error } = await supabase
    .from('chatbot_api_connections')
    .select('*')
    .eq('chatbot_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mask header values to avoid leaking secrets
  const masked = (connections || []).map((conn) => ({
    ...conn,
    headers: maskHeaders(conn.headers as Record<string, string>),
  }))

  return NextResponse.json(masked)
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

  const parsed = createConnectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }


  const ctaIssue = ctaTargetIssue(parsed.data)
  if (ctaIssue) {
    return NextResponse.json({ error: ctaIssue }, { status: 400 })
  }
  if (parsed.data.cta_type === 'form' && parsed.data.cta_form_id) {
    const owned = await ctaFormBelongsToChatbot(supabase, id, parsed.data.cta_form_id)
    if (!owned) {
      return NextResponse.json(
        { error: 'That form does not belong to this chatbot' },
        { status: 400 }
      )
    }
  }
  const cta = normaliseCta(parsed.data)

  const { data: connection, error } = await supabase
    .from('chatbot_api_connections')
    .insert({
      chatbot_id: id,
      name: parsed.data.name,
      description: parsed.data.description,
      method: parsed.data.method,
      url: parsed.data.url,
      headers: Object.fromEntries(
        Object.entries(parsed.data.headers || {}).filter(([, v]) => !isMasked(v))
      ),
      request_body_template: parsed.data.request_body_template || null,
      parameters: parsed.data.parameters || [],
      response_path: parsed.data.response_path || null,
      timeout_ms: parsed.data.timeout_ms || 10000,
      card_instructions: parsed.data.card_instructions || '',
      cta_type: cta.cta_type || 'none',
      cta_label: parsed.data.cta_label || '',
      cta_form_id: cta.cta_form_id ?? null,
      cta_url: cta.cta_url ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(connection, { status: 201 })
}
