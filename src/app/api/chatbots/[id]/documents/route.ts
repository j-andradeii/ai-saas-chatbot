import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { chunkText } from '@/lib/rag'
import { embedText } from '@/lib/embeddings'

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      await parser.destroy()
      return result.text
    }
    case 'text/plain':
      return buffer.toString('utf-8')
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    }
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`)
  }
}

async function processDocument(documentId: string) {
  try {
    // Update status to processing
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    // Fetch document record
    const { data: doc, error: docError } = await supabaseAdmin
      .from('knowledge_documents')
      .select('*, chatbots(llm_provider)')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      throw new Error('Document not found')
    }

    // Download file from storage
    const { data: fileData, error: dlError } = await supabaseAdmin.storage
      .from('knowledge-docs')
      .download(doc.file_url)

    if (dlError || !fileData) {
      throw new Error(`Failed to download file: ${dlError?.message}`)
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Extract text
    const text = await extractText(buffer, doc.mime_type)

    // Chunk the text
    const chunks = chunkText(text, 500, 50)

    // Embed with the chatbot's own provider rather than always OpenAI. The
    // model id is stored so a later provider switch cannot silently mix
    // incomparable vectors into the same search.
    const provider = doc.chatbots?.llm_provider ?? 'openai'

    for (let i = 0; i < chunks.length; i++) {
      const { embedding, model } = await embedText(chunks[i], provider, 'document')
      await supabaseAdmin.from('document_chunks').insert({
        document_id: documentId,
        chatbot_id: doc.chatbot_id,
        content: chunks[i],
        embedding,
        embedding_model: model,
        chunk_index: i,
      })
    }

    // Update status to ready
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ status: 'ready' })
      .eq('id', documentId)
  } catch (err) {
    console.error('processDocument error:', err)
    await supabaseAdmin
      .from('knowledge_documents')
      .update({
        status: 'error',
        error_message: err instanceof Error ? err.message : 'Unknown error',
      })
      .eq('id', documentId)
  }
}

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

  // Verify chatbot ownership
  const { data: chatbot } = await supabase
    .from('chatbots')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!chatbot || chatbot.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: documents, error } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('chatbot_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(documents)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatbotId } = await params
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

  const body = await request.json() as { documentId: string }
  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
  }

  // Verify document belongs to this chatbot
  const { data: doc } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, chatbot_id')
    .eq('id', body.documentId)
    .eq('chatbot_id', chatbotId)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Delete old chunks before reprocessing
  await supabaseAdmin
    .from('document_chunks')
    .delete()
    .eq('document_id', doc.id)

  // Reset status
  await supabaseAdmin
    .from('knowledge_documents')
    .update({ status: 'pending', error_message: null })
    .eq('id', doc.id)

  // Reprocess in the background
  after(async () => {
    await processDocument(doc.id)
  })

  return NextResponse.json({ success: true, documentId: doc.id })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatbotId } = await params
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

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PDF, TXT, DOCX' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10MB' },
      { status: 400 }
    )
  }

  // Upload to Supabase Storage
  const storagePath = `${user.id}/${chatbotId}/${file.name}`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('knowledge-docs')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // Insert document record
  const { data: document, error: insertError } = await supabaseAdmin
    .from('knowledge_documents')
    .insert({
      chatbot_id: chatbotId,
      file_name: file.name,
      file_url: storagePath,
      file_size: file.size,
      mime_type: file.type,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !document) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create document record' },
      { status: 500 }
    )
  }

  // Process document in the background
  after(async () => {
    await processDocument(document.id)
  })

  return NextResponse.json(document, { status: 201 })
}
