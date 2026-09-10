-- =============================================================
-- Enquiry Funnel / Pipeline System
-- Turns enquiries (leads) into a managed sales funnel with
-- stages, priority, deal value, an activity timeline, and tasks.
-- =============================================================

-- -------------------------------------------------------------
-- 1. Extend `enquiries` with funnel / pipeline fields
-- -------------------------------------------------------------
ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS pipeline_stage   TEXT NOT NULL DEFAULT 'new'
    CHECK (pipeline_stage IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  ADD COLUMN IF NOT EXISTS priority         TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS deal_value       NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS next_action_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lost_reason      TEXT,
  ADD COLUMN IF NOT EXISTS tags             TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_enquiries_pipeline_stage ON enquiries (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_enquiries_priority ON enquiries (priority);
CREATE INDEX IF NOT EXISTS idx_enquiries_next_action_at ON enquiries (next_action_at);

-- -------------------------------------------------------------
-- 2. enquiry_activities — audit trail + manual notes (timeline)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiry_activities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enquiry_id  UUID NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN (
      'note', 'stage_change', 'priority_change', 'value_change',
      'next_action', 'task_created', 'task_completed', 'read_status', 'system'
    )),
  content     TEXT NOT NULL DEFAULT '',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enquiry_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enquiry activities"
  ON enquiry_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enquiries e
      JOIN chatbots c ON c.id = e.chatbot_id
      WHERE e.id = enquiry_activities.enquiry_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own enquiry activities"
  ON enquiry_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enquiries e
      JOIN chatbots c ON c.id = e.chatbot_id
      WHERE e.id = enquiry_activities.enquiry_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enquiry activities"
  ON enquiry_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_enquiry_activities_enquiry_id ON enquiry_activities (enquiry_id);
CREATE INDEX idx_enquiry_activities_created_at ON enquiry_activities (created_at);

-- -------------------------------------------------------------
-- 3. enquiry_tasks — follow-up tasks / next actions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiry_tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enquiry_id   UUID NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  due_at       TIMESTAMPTZ,
  is_done      BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enquiry_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enquiry tasks"
  ON enquiry_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enquiries e
      JOIN chatbots c ON c.id = e.chatbot_id
      WHERE e.id = enquiry_tasks.enquiry_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own enquiry tasks"
  ON enquiry_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM enquiries e
      JOIN chatbots c ON c.id = e.chatbot_id
      WHERE e.id = enquiry_tasks.enquiry_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enquiry tasks"
  ON enquiry_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX idx_enquiry_tasks_enquiry_id ON enquiry_tasks (enquiry_id);
CREATE INDEX idx_enquiry_tasks_due_at ON enquiry_tasks (due_at);
CREATE INDEX idx_enquiry_tasks_is_done ON enquiry_tasks (is_done);
