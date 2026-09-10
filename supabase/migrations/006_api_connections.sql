-- =============================================================
-- API Connections — Let chatbots fetch live data from external APIs
-- =============================================================
CREATE TABLE chatbot_api_connections (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id             UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL,
  method                 TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  url                    TEXT NOT NULL,
  headers                JSONB NOT NULL DEFAULT '{}',
  request_body_template  JSONB,
  parameters             JSONB NOT NULL DEFAULT '[]',
  response_path          TEXT,
  timeout_ms             INTEGER NOT NULL DEFAULT 10000,
  is_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chatbot_api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chatbot api connections"
  ON chatbot_api_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = chatbot_api_connections.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all chatbot api connections"
  ON chatbot_api_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_api_connections_chatbot_id ON chatbot_api_connections (chatbot_id);
CREATE INDEX idx_api_connections_created_at ON chatbot_api_connections (created_at);
