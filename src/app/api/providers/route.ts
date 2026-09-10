import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: providers, error } = await supabaseAdmin
    .from('llm_providers')
    .select('id, name, display_name, is_enabled, llm_provider_models(id, name, input_cost_per_1m, output_cost_per_1m)')
    .eq('is_enabled', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map llm_provider_models to models for frontend consistency
  const mapped = providers.map((p: Record<string, unknown>) => ({
    ...p,
    models: p.llm_provider_models,
    llm_provider_models: undefined,
  }))

  return NextResponse.json(mapped)
}
