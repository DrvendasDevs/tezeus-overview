-- Drop existing restrictive policies on contact_observations
DROP POLICY IF EXISTS "Users can create observations in their workspace" ON contact_observations;
DROP POLICY IF EXISTS "Users can delete observations in their workspace" ON contact_observations;
DROP POLICY IF EXISTS "Users can update observations in their workspace" ON contact_observations;
DROP POLICY IF EXISTS "Users can view observations in their workspace" ON contact_observations;

-- Create permissive policies that work with the custom auth system
CREATE POLICY "Allow all operations on contact_observations"
ON contact_observations
FOR ALL
USING (true)
WITH CHECK (true);