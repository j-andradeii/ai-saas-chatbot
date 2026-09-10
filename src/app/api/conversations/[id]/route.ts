import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch conversation with chatbot info
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*, chatbots(id, name, user_id)')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Verify ownership: the chatbot must belong to this user
  if (conversation.chatbots?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch messages for this conversation ordered by created_at ascending
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  return NextResponse.json({
    ...conversation,
    messages: messages || [],
  })
}
