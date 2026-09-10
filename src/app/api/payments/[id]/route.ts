import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  return NextResponse.json(payment)
}
