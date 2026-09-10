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

const impersonateSchema = z.object({
  userId: z.string().uuid(),
})

// Check impersonation status (any authenticated user can check)
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/x-impersonate-user-id=([^;]+)/)
  if (!match) {
    return NextResponse.json({ impersonating: false })
  }

  const targetId = match[1]
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', targetId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ impersonating: false })
  }

  return NextResponse.json({
    impersonating: true,
    user: targetProfile,
  })
}

// Start impersonation
export async function POST(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = impersonateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  // Verify target user exists
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', parsed.data.userId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const response = NextResponse.json({
    message: `Now impersonating ${targetProfile.full_name || targetProfile.email}`,
    user: targetProfile,
  })

  response.cookies.set('x-impersonate-user-id', parsed.data.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour max
  })

  return response
}

// End impersonation
export async function DELETE() {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const response = NextResponse.json({ message: 'Impersonation ended' })
  response.cookies.delete('x-impersonate-user-id')
  return response
}
