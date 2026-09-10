-- =============================================================
-- Fix: infinite recursion in profiles RLS policy
-- The "Admins can view all profiles" policy queries the profiles
-- table itself, causing infinite recursion. Fix by using a
-- SECURITY DEFINER function that bypasses RLS.
-- =============================================================

-- Create helper function that bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Recreate using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());
