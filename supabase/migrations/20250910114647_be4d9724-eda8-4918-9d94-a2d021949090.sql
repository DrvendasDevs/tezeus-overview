-- Drop and recreate the workspace_webhook_settings policy to be more permissive
DROP POLICY IF EXISTS "workspace_webhook_settings_service_and_admin" ON public.workspace_webhook_settings;

-- Create new policy that allows system admins and workspace members with admin role
CREATE POLICY "workspace_webhook_settings_access" ON public.workspace_webhook_settings
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  is_current_user_admin() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  is_current_user_admin() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);