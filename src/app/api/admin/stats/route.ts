import { NextResponse } from 'next/server'
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

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    usersResult,
    chatbotsResult,
    conversationsResult,
    messagesResult,
    usersThisMonthResult,
    activeConversationsResult,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('chatbots').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('conversations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),
    supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])

  return NextResponse.json({
    totalUsers: usersResult.count ?? 0,
    totalChatbots: chatbotsResult.count ?? 0,
    totalConversations: conversationsResult.count ?? 0,
    totalMessages: messagesResult.count ?? 0,
    usersThisMonth: usersThisMonthResult.count ?? 0,
    activeConversations: activeConversationsResult.count ?? 0,
  })
}
