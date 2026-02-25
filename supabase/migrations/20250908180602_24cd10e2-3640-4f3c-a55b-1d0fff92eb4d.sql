-- Create workspace webhook settings table
CREATE TABLE IF NOT EXISTS public.workspace_webhook_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  webhook_secret text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable RLS for workspace_webhook_settings
ALTER TABLE public.workspace_webhook_settings DISABLE ROW LEVEL SECURITY;

-- Add use_workspace_default column to connections
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS use_workspace_default boolean DEFAULT true;

-- Create webhook logs table  
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id),
  instance_id text,
  event_type text,
  status text,
  payload_json jsonb,
  response_status int,
  response_body text,
  created_at timestamptz DEFAULT now()
);

-- Disable RLS for webhook_logs
ALTER TABLE public.webhook_logs DISABLE ROW LEVEL SECURITY;

-- Create index for better performance on logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_workspace_created 
ON public.webhook_logs(workspace_id, created_at DESC);