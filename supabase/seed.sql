-- =============================================================
-- Seed Data — Admin Account
-- =============================================================
-- This seed creates a pre-configured admin user for local development.
--
-- Credentials:
--   Email:    admin@chatbot.local
--   Password: admin123456
--
-- Run after migrations: supabase db reset (applies migrations + seed)
-- Or manually: psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/seed.sql
-- =============================================================

-- 1. Create the auth user (Supabase auth.users table)
--    All varchar/text columns must be explicitly set to '' (not NULL)
--    to avoid GoTrue scan errors like "converting NULL to string is unsupported"
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  email_change_confirm_status,
  phone,
  phone_change,
  phone_change_token,
  reauthentication_token,
  is_sso_user,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@chatbot.local',
  crypt('admin123456', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Platform Admin"}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  '',
  0,
  '',
  '',
  '',
  '',
  false,
  false
) ON CONFLICT (id) DO NOTHING;

-- 2. Create the identity record (required for email/password login)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'admin@chatbot.local',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'admin@chatbot.local'),
  'email',
  now(),
  now(),
  now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- 3. Upgrade the profile to admin role
--    (The profile row is auto-created by the handle_new_user() trigger above)
UPDATE public.profiles
SET
  role       = 'admin',
  full_name  = 'Platform Admin',
  plan       = 'enterprise',
  message_limit = 50000
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 4. Seed default platform settings (bank details + defaults)
INSERT INTO public.platform_settings (key, value) VALUES
  ('rate_limit_per_minute', '"20"'),
  ('max_file_upload_mb',    '"10"'),
  ('bank_name',             '"BDO Unibank"'),
  ('bank_account_name',     '"AI Chatbot Services Inc."'),
  ('bank_branch',           '"Makati Main"'),
  ('bank_account_number',   '"001234567890"'),
  ('bank_additional_instructions', '"Please include your email address in the transfer reference."')
ON CONFLICT (key) DO NOTHING;
