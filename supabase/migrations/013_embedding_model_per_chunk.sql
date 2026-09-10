-- Knowledge-base embeddings used to be OpenAI-only. They now follow the
-- chatbot's own LLM provider (Gemini included), which means chunks in this
-- table can come from different embedding models over time.
--
-- Vectors from different models occupy different spaces: cosine distance
-- between an OpenAI vector and a Gemini one is noise, not similarity. So record
-- which model produced each chunk and let match_chunks() compare like with like.

-- Existing rows all predate the change, so they are OpenAI vectors.
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small';

-- Keeps the model filter cheap alongside the existing chatbot_id lookup.
CREATE INDEX IF NOT EXISTS idx_document_chunks_chatbot_model
  ON document_chunks (chatbot_id, embedding_model);

-- Dropped rather than CREATE OR REPLACE'd: adding a parameter changes the
-- signature, which would leave the old 4-argument version in place as an
-- overload and make the call ambiguous.
DROP FUNCTION IF EXISTS match_chunks(extensions.vector(1536), UUID, INT, FLOAT);

CREATE FUNCTION match_chunks(
  query_embedding extensions.vector(1536),
  chatbot_id_param UUID,
  match_count INT,
  match_threshold FLOAT,
  embedding_model_param TEXT DEFAULT NULL
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
    -- NULL means "any model", so an older caller that omits the argument keeps
    -- its previous behaviour instead of silently matching nothing.
    AND (embedding_model_param IS NULL OR dc.embedding_model = embedding_model_param)
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
