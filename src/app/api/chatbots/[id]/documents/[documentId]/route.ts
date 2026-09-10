import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id: chatbotId, documentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify chatbot ownership
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', chatbotId)
    .single()

  if (!chatbot || chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch document to get file path
  const { data: doc, error: docError } = await supabaseAdmin
    .from('knowledge_documents')
    .select('file_url')
    .eq('id', documentId)
    .eq('chatbot_id', chatbotId)
    .single()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Delete from storage
  await supabaseAdmin.storage.from('knowledge-docs').remove([doc.file_url])

  // Delete document record (cascade deletes chunks)
  const { error: deleteError } = await supabaseAdmin
    .from('knowledge_documents')
    .delete()
    .eq('id', documentId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
