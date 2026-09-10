-- Bank transfer details move from Australian to Philippine format.
--
-- "BSB" is an Australian routing code with no Philippine equivalent: domestic
-- peso transfers are quoted as bank + branch + account number. This renames the
-- settings key and swaps the Australian placeholders for Philippine ones.
--
-- Every value change is guarded on the row still holding the untouched seed
-- default, so real bank details an admin has already entered are never
-- overwritten by this migration.

-- 1. Carry any existing value across to the new key, then retire the old one.
INSERT INTO platform_settings (key, value)
SELECT 'bank_branch', value
FROM platform_settings
WHERE key = 'bank_bsb'
ON CONFLICT (key) DO NOTHING;

DELETE FROM platform_settings WHERE key = 'bank_bsb';

-- 2. Replace the Australian seed placeholders only.
UPDATE platform_settings
SET value = '"BDO Unibank"'::jsonb, updated_at = now()
WHERE key = 'bank_name' AND value = '"Commonwealth Bank"'::jsonb;

UPDATE platform_settings
SET value = '"AI Chatbot Services Inc."'::jsonb, updated_at = now()
WHERE key = 'bank_account_name' AND value = '"AI Chatbot Pty Ltd"'::jsonb;

UPDATE platform_settings
SET value = '"Makati Main"'::jsonb, updated_at = now()
WHERE key = 'bank_branch' AND value = '"062-000"'::jsonb;

UPDATE platform_settings
SET value = '"001234567890"'::jsonb, updated_at = now()
WHERE key = 'bank_account_number' AND value = '"12345678"'::jsonb;
