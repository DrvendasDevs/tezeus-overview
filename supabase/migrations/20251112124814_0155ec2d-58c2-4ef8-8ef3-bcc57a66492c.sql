-- Add RLS policies for queues table

-- Master can do everything
CREATE POLICY "queues_master_all" ON queues
FOR ALL
TO authenticated
USING (
  is_current_user_master()
)
WITH CHECK (
  is_current_user_master()
);

-- Admins can manage queues in their workspace
CREATE POLICY "queues_admin_manage" ON queues
FOR ALL
TO authenticated
USING (
  is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Users can view queues in their workspace
CREATE POLICY "queues_user_select" ON queues
FOR SELECT
TO authenticated
USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
);