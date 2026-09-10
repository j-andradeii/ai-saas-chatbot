import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  cardDisplayFields,
  ctaTargetIssue,
  ctaFormBelongsToChatbot,
  normaliseCta,
} from '@/lib/api-connection-card'
import { mergeMaskedHeaders } from '@/lib/api-connection-headers'

const parameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().min(1),
  required: z.boolean(),
})

const updateConnectionSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Must be snake_case').optional(),
  description: z.string().min(1).max(500).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  url: z.string().min(1).max(2000).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  request_body_template: z.record(z.string(), z.unknown()).optional().nullable(),
  parameters: z.array(parameterSchema).optional(),
  response_path: z.string().max(200).optional().nullable(),
  timeout_ms: z.number().int().min(1000).max(30000).optional(),
  is_enabled: z.boolean().optional(),
  ...cardDisplayFields,
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  const { id, connectionId } = await params
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

  const parsed = updateConnectionSchema.safeParse(body)
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

  // Header values come back masked from GET. Anything still masked must keep
  // its stored secret rather than overwriting it with bullet characters.
  let headers = parsed.data.headers
  if (headers) {
    const { data: existing } = await supabase
      .from('chatbot_api_connections')
      .select('headers')
      .eq('id', connectionId)
      .eq('chatbot_id', id)
      .single()
    headers = mergeMaskedHeaders(headers, (existing?.headers as Record<string, string>) || {})
  }

  const { data: connection, error } = await supabase
    .from('chatbot_api_connections')
    .update({ ...parsed.data, ...cta, ...(headers ? { headers } : {}) })
    .eq('id', connectionId)
    .eq('chatbot_id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(connection)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  const { id, connectionId } = await params
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
    .from('chatbot_api_connections')
    .delete()
    .eq('id', connectionId)
    .eq('chatbot_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
