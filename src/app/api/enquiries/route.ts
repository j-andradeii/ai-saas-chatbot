import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const chatbotId = searchParams.get('chatbotId')
  const formName = searchParams.get('formName')
  const isRead = searchParams.get('isRead')

  // Get user's chatbot IDs first
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('id')
    .eq('user_id', user.id)

  if (!chatbots || chatbots.length === 0) {
    return NextResponse.json([])
  }

  const chatbotIds = chatbots.map((c: { id: string }) => c.id)

  let query = supabase
    .from('enquiries')
    .select('*')
    .in('chatbot_id', chatbotIds)
    .order('created_at', { ascending: false })

  if (chatbotId) {
    query = query.eq('chatbot_id', chatbotId)
  }
  if (formName) {
    query = query.eq('form_name', formName)
  }
  if (isRead === 'true') {
    query = query.eq('is_read', true)
  } else if (isRead === 'false') {
    query = query.eq('is_read', false)
  }

  const { data: enquiries, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(enquiries)
}
