-- Google retired both Gemini models seeded in 001_initial_schema.sql:
--
--   gemini-2.0-flash              -- listed as shut down
--   gemini-2.5-pro-preview-05-06  -- deprecated 2025-06-19, no longer listed
--
-- Because /api/providers only offers what this table holds, the model picker
-- contained nothing that still works, and any chatbot on either id got an error
-- back from the provider on every message.
--
-- Prices are USD per 1M tokens from https://ai.google.dev/gemini-api/docs/models
-- and are display-only -- nothing bills off them.

-- 1. Add the current GA line-up.
--
--    gemini-3.8-flash is on introductory pricing that DOUBLES to 1.50 / 7.50 on
--    2027-01-01. Update those two numbers then, or the picker will understate
--    the cost.
INSERT INTO llm_provider_models (provider_id, name, input_cost_per_1m, output_cost_per_1m)
SELECT p.id, m.name, m.input_cost, m.output_cost
FROM llm_providers p
CROSS JOIN (VALUES
  ('gemini-3.8-flash',      0.7500, 3.7500),
  ('gemini-3.5-flash',      1.5000, 9.0000),
  ('gemini-3.5-flash-lite', 0.3000, 2.5000)
) AS m(name, input_cost, output_cost)
WHERE p.name = 'google'
  -- Guard rather than ON CONFLICT: (provider_id, name) carries no unique index,
  -- so a plain re-run would duplicate rows instead of erroring.
  AND NOT EXISTS (
    SELECT 1 FROM llm_provider_models existing
    WHERE existing.provider_id = p.id
      AND existing.name = m.name
  );

-- 2. Move existing chatbots off the retired ids BEFORE the rows go away.
--
--    gemini-3.8-flash rather than the cheaper flash-lite because these chatbots
--    call tools (enquiry forms, API connections) and drive them through up to
--    three steps; the lite tier is markedly weaker at multi-step tool use. Until
--    2027-01-01 it is also cheaper than gemini-3.5-flash on both input and
--    output, so it is the better default on price as well.
UPDATE chatbots
SET llm_model = 'gemini-3.8-flash'
WHERE llm_provider = 'google'
  AND llm_model IN ('gemini-2.0-flash', 'gemini-2.5-pro-preview-05-06');

-- 3. Drop the retired rows so they stop appearing in the picker.
DELETE FROM llm_provider_models
WHERE name IN ('gemini-2.0-flash', 'gemini-2.5-pro-preview-05-06')
  AND provider_id IN (SELECT id FROM llm_providers WHERE name = 'google');
