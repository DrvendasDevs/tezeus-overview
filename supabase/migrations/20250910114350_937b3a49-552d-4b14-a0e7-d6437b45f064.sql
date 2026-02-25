-- Enable RLS on workspace_webhook_settings
ALTER TABLE public.workspace_webhook_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspace_webhook_settings
CREATE POLICY "workspace_webhook_settings_service_and_admin" ON public.workspace_webhook_settings
FOR ALL USING (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Also enable RLS on webhook_logs if not already enabled
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for webhook_logs  
CREATE POLICY "webhook_logs_workspace_members" ON public.webhook_logs
FOR ALL USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
)
WITH CHECK (
  is_workspace_member(workspace_id, 'user'::system_profile)
);