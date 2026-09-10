-- =============================================================
-- Phase 2 - Knowledge Base & RAG
-- AI Chatbot SaaS Platform
-- =============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;

-- =============================================================
-- 1. document_chunks table
-- =============================================================
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES knowledge_documents (id) ON DELETE CASCADE,
  chatbot_id    UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  embedding     extensions.vector(1536) NOT NULL,
  chunk_index   INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document chunks"
  ON document_chunks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = document_chunks.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all document chunks"
  ON document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_document_chunks_document_id ON document_chunks (document_id);
CREATE INDEX idx_document_chunks_chatbot_id ON document_chunks (chatbot_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding extensions.vector_cosine_ops);

-- =============================================================
-- 2. match_chunks RPC function
-- =============================================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding extensions.vector(1536),
  chatbot_id_param UUID,
  match_count INT,
  match_threshold FLOAT
)
RETURNS TABLE (content TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM document_chunks dc
  WHERE dc.chatbot_id = chatbot_id_param
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================
-- 3. Storage bucket for knowledge documents
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-docs', 'knowledge-docs', false);

-- Storage policies: authenticated users can upload/read/delete their own files
CREATE POLICY "Users can upload knowledge docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Users can read own knowledge docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'knowledge-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "Users can delete own knowledge docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'knowledge-docs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
