import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BANK_KEYS = [
  'bank_name',
  'bank_account_name',
  'bank_branch',
  'bank_account_number',
  'bank_additional_instructions',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value')
    .in('key', BANK_KEYS)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const bankDetails: Record<string, string> = {}
  for (const row of data ?? []) {
    bankDetails[row.key] = typeof row.value === 'string'
      ? row.value.replace(/^"|"$/g, '')
      : String(row.value ?? '')
  }

  return NextResponse.json(bankDetails)
}
