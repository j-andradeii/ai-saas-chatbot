import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

export async function GET(request: Request) {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('payments')
    .select('*, profiles!payments_user_id_fkey(full_name, email, company_name, plan)')
    .order('created_at', { ascending: true })

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(payments)
}
