-- Lead scoring: how likely an enquiry is to convert into an actual booking,
-- judged from the chat transcript that produced it.
--
-- Deliberately separate from `priority` (migration 007). priority is what the
-- operator decides; lead_score is what the model inferred from the conversation.
-- Keeping them apart means a human override never gets overwritten by a rescore.

ALTER TABLE enquiries
  -- NULL means "not scored yet" -- rows that predate this migration, enquiries
  -- with no conversation attached, and any run where the model call failed.
  ADD COLUMN IF NOT EXISTS lead_score           INTEGER
    CHECK (lead_score IS NULL OR lead_score BETWEEN 0 AND 100),
  -- One or two sentences the operator can read before picking up the phone.
  ADD COLUMN IF NOT EXISTS lead_score_rationale TEXT,
  -- Short phrases: "gave exact travel dates", "asked about group rates".
  ADD COLUMN IF NOT EXISTS lead_score_signals   TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_scored_at       TIMESTAMPTZ,
  -- Which model produced it, so a scoring-prompt or model change is traceable
  -- rather than silently shifting every number.
  ADD COLUMN IF NOT EXISTS lead_score_model     TEXT;

-- The list view's default sort is "hottest first", and the partial index keeps
-- unscored rows out of it rather than bloating the index with NULLs.
CREATE INDEX IF NOT EXISTS idx_enquiries_lead_score
  ON enquiries (chatbot_id, lead_score DESC)
  WHERE lead_score IS NOT NULL;
