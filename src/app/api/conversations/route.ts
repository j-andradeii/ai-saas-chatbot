import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const chatbotId = searchParams.get('chatbotId')
  const status = searchParams.get('status')

  // First get user's chatbot IDs
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('id')
    .eq('user_id', user.id)

  const chatbotIds = chatbots?.map(c => c.id) || []
  if (chatbotIds.length === 0) return NextResponse.json([])

  let query = supabase
    .from('conversations')
    .select('*, chatbots(name)')
    .in('chatbot_id', chatbotIds)
    .order('updated_at', { ascending: false })

  if (chatbotId) query = query.eq('chatbot_id', chatbotId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
