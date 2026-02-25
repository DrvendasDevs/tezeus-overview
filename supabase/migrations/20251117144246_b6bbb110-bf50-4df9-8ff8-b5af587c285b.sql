-- Drop existing restrictive policies on quick_funnels
DROP POLICY IF EXISTS "Users can view funnels in their workspace" ON quick_funnels;
DROP POLICY IF EXISTS "Users can insert funnels in their workspace" ON quick_funnels;
DROP POLICY IF EXISTS "Users can update funnels in their workspace" ON quick_funnels;
DROP POLICY IF EXISTS "Users can delete funnels in their workspace" ON quick_funnels;

-- Create simple policies like tags (allow all operations)
CREATE POLICY "Allow all operations on quick_funnels"
ON quick_funnels
FOR ALL
USING (true)
WITH CHECK (true);