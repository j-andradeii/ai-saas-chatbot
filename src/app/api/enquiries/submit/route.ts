import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { chatRatelimit } from '@/lib/ratelimit'
import type { EnquiryFormField } from '@/types'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success: withinLimit } = await chatRatelimit.limit(ip)
  if (!withinLimit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: corsHeaders }
    )
  }

  try {
    const body = await request.json()
    const { chatbotId, formId, data, conversationId, visitorId } = body as {
      chatbotId?: string
      formId?: string
      data?: Record<string, unknown>
      conversationId?: string
      visitorId?: string
    }

    if (!chatbotId || !formId || !data) {
      return NextResponse.json(
        { error: 'chatbotId, formId, and data are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch the form and verify it exists + is enabled
    const { data: form, error: formError } = await supabaseAdmin
      .from('enquiry_forms')
      .select('*')
      .eq('id', formId)
      .eq('chatbot_id', chatbotId)
      .eq('is_enabled', true)
      .single()

    if (formError || !form) {
      return NextResponse.json(
        { error: 'Form not found or disabled' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Validate required fields and basic format
    const fields = form.fields as EnquiryFormField[]
    const errors: Record<string, string> = {}

    for (const field of fields) {
      const value = data[field.name]

      if (field.required && (value === undefined || value === null || value === '')) {
        errors[field.name] = `${field.label} is required`
        continue
      }

      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'email' && typeof value === 'string') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors[field.name] = 'Invalid email address'
          }
        }

        if (field.type === 'select' && field.options && field.options.length > 0) {
          if (!field.options.includes(String(value))) {
            errors[field.name] = 'Invalid selection'
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 422, headers: corsHeaders }
      )
    }

    // Fire webhook if configured
    let webhookStatus: 'none' | 'sent' | 'failed' = 'none'
    let webhookResponseCode: number | null = null
    const visitorIp = request.headers.get('x-forwarded-for') ?? undefined

    if (form.webhook_url) {
      try {
        const webhookRes = await fetch(form.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            form_name: form.name,
            chatbot_id: chatbotId,
            data,
            submitted_at: new Date().toISOString(),
          }),
        })
        webhookResponseCode = webhookRes.status
        webhookStatus = webhookRes.ok ? 'sent' : 'failed'
      } catch {
        webhookStatus = 'failed'
      }
    }

    // Insert enquiry
    const { error: insertError } = await supabaseAdmin.from('enquiries').insert({
      enquiry_form_id: form.id,
      chatbot_id: chatbotId,
      conversation_id: conversationId || null,
      form_name: form.name,
      data,
      visitor_id: visitorId || null,
      visitor_ip: visitorIp || null,
      webhook_status: webhookStatus,
      webhook_response_code: webhookResponseCode,
    })

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save enquiry' },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: form.success_message || 'Thank you! Your enquiry has been submitted.',
      },
      { headers: corsHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
