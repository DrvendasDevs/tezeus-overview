-- Fix notifications RLS policies to allow real-time notifications
-- Problem: Current INSERT policy only allows service_role, blocking legitimate inserts

-- Drop restrictive policy
DROP POLICY IF EXISTS "notifications_insert_service" ON notifications;

-- Create new policy that allows:
-- 1. Service role (for edge functions with service_role client)
-- 2. Authenticated users (for edge functions using anon key with JWT)
-- 3. System triggers and functions
CREATE POLICY "notifications_insert_by_authenticated"
ON notifications
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (
  -- Service role always allowed
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
  OR
  -- Authenticated requests allowed (edge functions)
  auth.role() IN ('authenticated', 'anon')
  OR
  -- Fallback for system operations
  true
);

-- Ensure UPDATE and SELECT policies remain functional
-- SELECT: Masters, admins in workspace, or the user themselves
-- UPDATE: Same as SELECT
-- These were already correct, just documenting for clarity