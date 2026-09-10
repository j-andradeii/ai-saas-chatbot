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

export async function GET() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Convert rows to a key-value object
  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }

  return NextResponse.json(settings)
}

const updateSchema = z.record(z.string(), z.unknown())

export async function PATCH(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  // Upsert each setting
  const entries = Object.entries(parsed.data)
  for (const [key, value] of entries) {
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert(
        { key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (error) {
      return NextResponse.json({ error: `Failed to update ${key}: ${error.message}` }, { status: 500 })
    }
  }

  // Return updated settings
  const { data } = await supabaseAdmin.from('platform_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }

  return NextResponse.json(settings)
}
