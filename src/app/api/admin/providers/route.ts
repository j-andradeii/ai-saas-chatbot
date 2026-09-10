import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { clearOpenAIClient } from '@/lib/openai'

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

function maskApiKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 4) return '****'
  return '****' + key.slice(-4)
}

export async function GET() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: providers, error } = await supabaseAdmin
    .from('llm_providers')
    .select('*, llm_provider_models(*)')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mask API keys — only show last 4 chars
  const masked = providers.map((p: Record<string, unknown>) => ({
    ...p,
    platform_api_key: maskApiKey(p.platform_api_key as string | null),
  }))

  return NextResponse.json(masked)
}

const updateProviderSchema = z.object({
  id: z.string().min(1),
  platform_api_key: z.string().optional(),
  is_enabled: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateProviderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { id, ...updates } = parsed.data

  const { data: provider, error } = await supabaseAdmin
    .from('llm_providers')
    .update(updates)
    .eq('id', id)
    .select('*, llm_provider_models(*)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Clear cached OpenAI client so it picks up the new key
  if (updates.platform_api_key) {
    clearOpenAIClient()
  }

  return NextResponse.json({
    ...provider,
    platform_api_key: maskApiKey(provider.platform_api_key),
  })
}
