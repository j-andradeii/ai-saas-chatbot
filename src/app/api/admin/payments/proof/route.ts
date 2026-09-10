import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 })
  }

  const { data, error: downloadError } = await supabaseAdmin.storage
    .from('payment-proofs')
    .download(path)

  if (downloadError || !data) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const headers = new Headers()
  headers.set('Content-Type', data.type || 'application/octet-stream')
  headers.set('Cache-Control', 'private, max-age=3600')

  return new Response(data, { headers })
}
