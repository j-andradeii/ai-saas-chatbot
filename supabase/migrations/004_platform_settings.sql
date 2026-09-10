-- =============================================================
-- Platform Settings — key-value config table
-- =============================================================

CREATE TABLE platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Only admins can read/write
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings"
  ON platform_settings FOR ALL
  USING (is_admin());

-- Seed default values
INSERT INTO platform_settings (key, value) VALUES
  ('rate_limit_per_minute', '20'),
  ('max_file_upload_mb', '10'),
  ('plan_free', '{"message_limit": 100, "chatbot_limit": 1}'),
  ('plan_pro', '{"message_limit": 5000, "chatbot_limit": 5}'),
  ('plan_enterprise', '{"message_limit": 50000, "chatbot_limit": 20}');
