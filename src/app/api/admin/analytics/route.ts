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

export async function GET(request: Request) {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const days = Math.min(Number(searchParams.get('days') || '30'), 90)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  // Run all queries in parallel
  const [
    planBreakdownResult,
    newUsersResult,
    messagesResult,
    topChatbotsResult,
    conversationStatusResult,
  ] = await Promise.all([
    // Users by plan
    supabaseAdmin.from('profiles').select('plan'),

    // New users per day (last N days)
    supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true }),

    // Messages per day (last N days)
    supabaseAdmin
      .from('messages')
      .select('created_at')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true }),

    // Top chatbots by message volume
    supabaseAdmin
      .from('chatbots')
      .select('id, name, messages(count)')
      .order('created_at', { ascending: false })
      .limit(10),

    // Conversations by status
    supabaseAdmin.from('conversations').select('status'),
  ])

  // Aggregate plan breakdown
  const planBreakdown: Record<string, number> = { free: 0, pro: 0, enterprise: 0 }
  for (const p of planBreakdownResult.data ?? []) {
    planBreakdown[p.plan] = (planBreakdown[p.plan] || 0) + 1
  }

  // Aggregate new users per day
  const usersPerDay = aggregateByDay(
    (newUsersResult.data ?? []).map((r) => r.created_at),
    days
  )

  // Aggregate messages per day
  const messagesPerDay = aggregateByDay(
    (messagesResult.data ?? []).map((r) => r.created_at),
    days
  )

  // Format top chatbots
  const topChatbots = (topChatbotsResult.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      message_count: c.messages?.[0]?.count ?? 0,
    }))
    .sort((a, b) => b.message_count - a.message_count)
    .slice(0, 5)

  // Aggregate conversation status
  const conversationStatus: Record<string, number> = {}
  for (const c of conversationStatusResult.data ?? []) {
    conversationStatus[c.status] = (conversationStatus[c.status] || 0) + 1
  }

  // Estimated MRR
  const planPrices: Record<string, number> = { free: 0, pro: 29, enterprise: 99 }
  const estimatedMRR = Object.entries(planBreakdown).reduce(
    (sum, [plan, count]) => sum + (planPrices[plan] ?? 0) * count,
    0
  )

  return NextResponse.json({
    planBreakdown,
    usersPerDay,
    messagesPerDay,
    topChatbots,
    conversationStatus,
    estimatedMRR,
  })
}

function aggregateByDay(timestamps: string[], days: number) {
  const counts: Record<string, number> = {}

  // Pre-fill all days with 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    counts[d.toISOString().split('T')[0]] = 0
  }

  for (const ts of timestamps) {
    const day = ts.split('T')[0]
    if (day in counts) {
      counts[day]++
    }
  }

  return Object.entries(counts).map(([date, count]) => ({ date, count }))
}
