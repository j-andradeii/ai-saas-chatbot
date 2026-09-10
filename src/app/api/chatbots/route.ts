import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, type PlanName } from '@/lib/billing'

const createChatbotSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  domain: z.string().min(1, 'Domain is required').max(255),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: chatbots, error } = await supabase
    .from('chatbots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(chatbots)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Enforce chatbot count limit per plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  const plan = (profile?.plan ?? 'free') as PlanName
  const limit = PLAN_LIMITS[plan].chatbots

  const { count } = await supabase
    .from('chatbots')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `You have reached the chatbot limit for your ${plan} plan (${limit} chatbot${limit === 1 ? '' : 's'}). Please upgrade to create more.`,
        plan,
        limit,
        current: count,
      },
      { status: 402 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createChatbotSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { data: chatbot, error } = await supabase
    .from('chatbots')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      domain: parsed.data.domain,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(chatbot, { status: 201 })
}
