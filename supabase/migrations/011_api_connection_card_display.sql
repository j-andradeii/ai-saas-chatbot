-- Per-connection card presentation: free-text display instructions for the
-- assistant, plus an optional call-to-action button rendered on every card.

ALTER TABLE chatbot_api_connections
  ADD COLUMN card_instructions TEXT NOT NULL DEFAULT '',
  ADD COLUMN cta_type          TEXT NOT NULL DEFAULT 'none'
    CHECK (cta_type IN ('none', 'form', 'link')),
  ADD COLUMN cta_label         TEXT NOT NULL DEFAULT '',
  ADD COLUMN cta_form_id       UUID REFERENCES enquiry_forms (id) ON DELETE SET NULL,
  ADD COLUMN cta_url           TEXT;

-- A CTA is only meaningful with a target, and the target must match the type.
ALTER TABLE chatbot_api_connections
  ADD CONSTRAINT api_connection_cta_target CHECK (
    cta_type = 'none'
    OR (cta_type = 'form' AND cta_form_id IS NOT NULL)
    OR (cta_type = 'link' AND cta_url IS NOT NULL AND cta_url <> '')
  );

COMMENT ON COLUMN chatbot_api_connections.card_instructions IS
  'Free-text guidance injected into the system prompt telling the assistant how to present this connection''s results.';
COMMENT ON COLUMN chatbot_api_connections.cta_url IS
  'Link CTA target. May contain {field} placeholders resolved per card from the item data, e.g. https://site.com/tours/{slug}';
