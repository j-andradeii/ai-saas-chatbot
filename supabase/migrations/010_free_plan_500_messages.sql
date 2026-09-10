-- Free plan message allowance: 100 -> 500.
--
-- Three things have to move together, or new signups keep getting 100:
--   1. the column DEFAULT — handle_new_user() does not set message_limit, so
--      the default is what every new signup actually receives;
--   2. existing free accounts still sitting on the old default;
--   3. the plan_free row the admin Settings screen reads.
--
-- (2) and (3) are guarded on the old value so a limit an admin deliberately
-- set for a specific user or plan is never overwritten.

-- 1. New signups.
ALTER TABLE profiles
  ALTER COLUMN message_limit SET DEFAULT 500;

-- 2. Existing free accounts still on the old default.
UPDATE profiles
SET message_limit = 500, updated_at = now()
WHERE plan = 'free' AND message_limit = 100;

-- 3. The admin-editable plan definition.
UPDATE platform_settings
SET value = jsonb_set(value, '{message_limit}', '500'::jsonb), updated_at = now()
WHERE key = 'plan_free' AND value -> 'message_limit' = '100'::jsonb;
