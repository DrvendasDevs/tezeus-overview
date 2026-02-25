-- Enable RLS on quick_funnels table
ALTER TABLE quick_funnels ENABLE ROW LEVEL SECURITY;

-- Policy for users to view funnels in their workspace
CREATE POLICY "Users can view funnels in their workspace"
ON quick_funnels
FOR SELECT
USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Policy for users to insert funnels in their workspace
CREATE POLICY "Users can insert funnels in their workspace"
ON quick_funnels
FOR INSERT
WITH CHECK (
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Policy for users to update funnels in their workspace
CREATE POLICY "Users can update funnels in their workspace"
ON quick_funnels
FOR UPDATE
USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Policy for users to delete funnels in their workspace
CREATE POLICY "Users can delete funnels in their workspace"
ON quick_funnels
FOR DELETE
USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
);