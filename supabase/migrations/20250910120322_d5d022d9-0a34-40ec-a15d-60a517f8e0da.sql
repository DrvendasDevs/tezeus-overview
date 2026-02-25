-- Fix RLS policies to allow proper workspace access

-- Drop and recreate workspace_webhook_settings_access policy to include master access
DROP POLICY IF EXISTS "workspace_webhook_settings_access" ON public.workspace_webhook_settings;

CREATE POLICY "workspace_webhook_settings_access" 
ON public.workspace_webhook_settings 
FOR ALL 
USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR 
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
)
WITH CHECK (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR 
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Clean up any data that references the deprecated workspace ID
DELETE FROM public.workspace_limits WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM public.connections WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;
DELETE FROM public.dashboard_cards WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;