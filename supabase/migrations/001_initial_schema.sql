-- =============================================================
-- Phase 1 - Initial Schema
-- AI Chatbot SaaS Platform
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- Helper: update_updated_at trigger function
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 1. profiles
-- =============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name     TEXT,
  email         TEXT,
  company_name  TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  message_count INTEGER NOT NULL DEFAULT 0,
  message_limit INTEGER NOT NULL DEFAULT 100,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  billing_period_start TIMESTAMPTZ,
  stripe_customer_id   TEXT,
  avatar_url           TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Policies: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_profiles_email ON profiles (email);
CREATE INDEX idx_profiles_role ON profiles (role);
CREATE INDEX idx_profiles_plan ON profiles (plan);
CREATE INDEX idx_profiles_created_at ON profiles (created_at);

-- =============================================================
-- Auto-create profile on auth.users insert
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- 2. payments
-- =============================================================
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  amount            NUMERIC(10, 2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'AUD',
  plan_requested    TEXT NOT NULL CHECK (plan_requested IN ('pro', 'enterprise')),
  billing_cycle     TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  proof_url         TEXT NOT NULL,
  proof_file_name   TEXT,
  reference_number  TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes       TEXT,
  reviewed_by       UUID REFERENCES profiles (id),
  reviewed_at       TIMESTAMPTZ,
  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_payments_user_id ON payments (user_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_created_at ON payments (created_at);

-- =============================================================
-- 3. llm_providers
-- =============================================================
CREATE TABLE llm_providers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL UNIQUE,
  display_name     TEXT NOT NULL,
  platform_api_key TEXT,
  is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE llm_providers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER llm_providers_updated_at
  BEFORE UPDATE ON llm_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- All authenticated users can view providers (no keys exposed via RLS)
CREATE POLICY "Authenticated users can view providers"
  ON llm_providers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage providers"
  ON llm_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_llm_providers_name ON llm_providers (name);
CREATE INDEX idx_llm_providers_created_at ON llm_providers (created_at);

-- =============================================================
-- 4. llm_provider_models
-- =============================================================
CREATE TABLE llm_provider_models (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id         UUID NOT NULL REFERENCES llm_providers (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  input_cost_per_1m   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  output_cost_per_1m  NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE llm_provider_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view models"
  ON llm_provider_models FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage models"
  ON llm_provider_models FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_llm_provider_models_provider_id ON llm_provider_models (provider_id);
CREATE INDEX idx_llm_provider_models_created_at ON llm_provider_models (created_at);

-- =============================================================
-- 5. chatbots
-- =============================================================
CREATE TABLE chatbots (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  domain             TEXT NOT NULL,
  personality_prompt TEXT NOT NULL DEFAULT '',
  welcome_message    TEXT NOT NULL DEFAULT 'Hello! How can I help you today?',
  skills             TEXT[] NOT NULL DEFAULT '{}',
  quick_actions      JSONB NOT NULL DEFAULT '[]',
  llm_provider       TEXT NOT NULL DEFAULT 'openai',
  llm_model          TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  api_key            TEXT NOT NULL DEFAULT '',
  primary_color      TEXT NOT NULL DEFAULT '#6366f1',
  widget_position    TEXT NOT NULL DEFAULT 'bottom-right' CHECK (widget_position IN ('bottom-right', 'bottom-left')),
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER chatbots_updated_at
  BEFORE UPDATE ON chatbots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Users can view own chatbots"
  ON chatbots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chatbots"
  ON chatbots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chatbots"
  ON chatbots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chatbots"
  ON chatbots FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all chatbots"
  ON chatbots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_chatbots_user_id ON chatbots (user_id);
CREATE INDEX idx_chatbots_active ON chatbots (active);
CREATE INDEX idx_chatbots_created_at ON chatbots (created_at);

-- =============================================================
-- 6. chatbot_tools
-- =============================================================
CREATE TABLE chatbot_tools (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id   UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  parameters   JSONB NOT NULL DEFAULT '{}',
  webhook_url  TEXT,
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chatbot_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chatbot tools"
  ON chatbot_tools FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = chatbot_tools.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all chatbot tools"
  ON chatbot_tools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_chatbot_tools_chatbot_id ON chatbot_tools (chatbot_id);
CREATE INDEX idx_chatbot_tools_created_at ON chatbot_tools (created_at);

-- =============================================================
-- 7. enquiry_forms
-- =============================================================
CREATE TABLE enquiry_forms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id      UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  fields          JSONB NOT NULL DEFAULT '[]',
  webhook_url     TEXT,
  success_message TEXT NOT NULL DEFAULT 'Thank you!',
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enquiry_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own enquiry forms"
  ON enquiry_forms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = enquiry_forms.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enquiry forms"
  ON enquiry_forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_enquiry_forms_chatbot_id ON enquiry_forms (chatbot_id);
CREATE INDEX idx_enquiry_forms_created_at ON enquiry_forms (created_at);

-- =============================================================
-- 8. conversations (before enquiries, since enquiries references it)
-- =============================================================
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id    UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  visitor_id    TEXT NOT NULL,
  visitor_name  TEXT,
  visitor_email TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = conversations.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = conversations.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_conversations_chatbot_id ON conversations (chatbot_id);
CREATE INDEX idx_conversations_visitor_id ON conversations (visitor_id);
CREATE INDEX idx_conversations_status ON conversations (status);
CREATE INDEX idx_conversations_created_at ON conversations (created_at);

-- =============================================================
-- 9. enquiries
-- =============================================================
CREATE TABLE enquiries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enquiry_form_id       UUID REFERENCES enquiry_forms (id) ON DELETE SET NULL,
  chatbot_id            UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  conversation_id       UUID REFERENCES conversations (id) ON DELETE SET NULL,
  form_name             TEXT NOT NULL,
  data                  JSONB NOT NULL DEFAULT '{}',
  visitor_id            TEXT,
  visitor_ip            INET,
  webhook_status        TEXT NOT NULL DEFAULT 'none' CHECK (webhook_status IN ('none', 'pending', 'sent', 'failed')),
  webhook_response_code INTEGER,
  is_read               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enquiries"
  ON enquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = enquiries.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own enquiries"
  ON enquiries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = enquiries.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enquiries"
  ON enquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_enquiries_enquiry_form_id ON enquiries (enquiry_form_id);
CREATE INDEX idx_enquiries_chatbot_id ON enquiries (chatbot_id);
CREATE INDEX idx_enquiries_conversation_id ON enquiries (conversation_id);
CREATE INDEX idx_enquiries_webhook_status ON enquiries (webhook_status);
CREATE INDEX idx_enquiries_is_read ON enquiries (is_read);
CREATE INDEX idx_enquiries_created_at ON enquiries (created_at);

-- =============================================================
-- 10. knowledge_documents
-- =============================================================
CREATE TABLE knowledge_documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chatbot_id    UUID NOT NULL REFERENCES chatbots (id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own knowledge documents"
  ON knowledge_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chatbots c WHERE c.id = knowledge_documents.chatbot_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all knowledge documents"
  ON knowledge_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_knowledge_documents_chatbot_id ON knowledge_documents (chatbot_id);
CREATE INDEX idx_knowledge_documents_status ON knowledge_documents (status);
CREATE INDEX idx_knowledge_documents_created_at ON knowledge_documents (created_at);

-- =============================================================
-- 11. messages
-- =============================================================
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         TEXT NOT NULL,
  tool_name       TEXT,
  tool_data       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations conv
      JOIN chatbots c ON c.id = conv.chatbot_id
      WHERE conv.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own messages"
  ON messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conversations conv
      JOIN chatbots c ON c.id = conv.chatbot_id
      WHERE conv.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_role ON messages (role);
CREATE INDEX idx_messages_created_at ON messages (created_at);

-- =============================================================
-- Seed Data: LLM Providers and Models
-- =============================================================

-- OpenAI
INSERT INTO llm_providers (id, name, display_name) VALUES
  (uuid_generate_v4(), 'openai', 'OpenAI');

INSERT INTO llm_provider_models (provider_id, name, input_cost_per_1m, output_cost_per_1m)
SELECT p.id, m.name, m.input_cost, m.output_cost
FROM llm_providers p
CROSS JOIN (VALUES
  ('gpt-4o-mini', 0.1500, 0.6000),
  ('gpt-4o', 2.5000, 10.0000)
) AS m(name, input_cost, output_cost)
WHERE p.name = 'openai';

-- Anthropic
INSERT INTO llm_providers (id, name, display_name) VALUES
  (uuid_generate_v4(), 'anthropic', 'Anthropic');

INSERT INTO llm_provider_models (provider_id, name, input_cost_per_1m, output_cost_per_1m)
SELECT p.id, m.name, m.input_cost, m.output_cost
FROM llm_providers p
CROSS JOIN (VALUES
  ('claude-sonnet-4-20250514', 3.0000, 15.0000),
  ('claude-haiku-4-20250414', 0.8000, 4.0000)
) AS m(name, input_cost, output_cost)
WHERE p.name = 'anthropic';

-- Google
INSERT INTO llm_providers (id, name, display_name) VALUES
  (uuid_generate_v4(), 'google', 'Google');

INSERT INTO llm_provider_models (provider_id, name, input_cost_per_1m, output_cost_per_1m)
SELECT p.id, m.name, m.input_cost, m.output_cost
FROM llm_providers p
CROSS JOIN (VALUES
  ('gemini-2.0-flash', 0.1000, 0.4000),
  ('gemini-2.5-pro-preview-05-06', 1.2500, 10.0000)
) AS m(name, input_cost, output_cost)
WHERE p.name = 'google';
