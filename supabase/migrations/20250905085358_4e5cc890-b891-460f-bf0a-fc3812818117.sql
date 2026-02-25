-- Create connections table for Evolution instances
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  qr_code TEXT,
  phone_number TEXT,
  history_recovery TEXT DEFAULT 'none',
  history_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(workspace_id, instance_name)
);

-- Create connection_secrets table for sensitive data
CREATE TABLE IF NOT EXISTS public.connection_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  evolution_url TEXT NOT NULL DEFAULT 'https://evo.eventoempresalucrativa.com.br',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Create provider_logs table for observability
CREATE TABLE IF NOT EXISTS public.provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  correlation_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace_limits table for quota management
CREATE TABLE IF NOT EXISTS public.workspace_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  connection_limit INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connections
CREATE POLICY "connections_select" ON public.connections
  FOR SELECT USING (is_member(workspace_id));

CREATE POLICY "connections_insert" ON public.connections
  FOR INSERT WITH CHECK (is_member(workspace_id, 'ADMIN'::org_role));

CREATE POLICY "connections_update" ON public.connections
  FOR UPDATE USING (is_member(workspace_id, 'ADMIN'::org_role));

CREATE POLICY "connections_delete" ON public.connections
  FOR DELETE USING (is_member(workspace_id, 'ADMIN'::org_role));

-- RLS Policies for connection_secrets (service role only)
CREATE POLICY "connection_secrets_service_only" ON public.connection_secrets
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS Policies for provider_logs  
CREATE POLICY "provider_logs_select" ON public.provider_logs
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM public.connections c 
      WHERE c.id = provider_logs.connection_id 
      AND is_member(c.workspace_id)
    )
    OR connection_id IS NULL
  );

CREATE POLICY "provider_logs_insert" ON public.provider_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for workspace_limits
CREATE POLICY "workspace_limits_select" ON public.workspace_limits
  FOR SELECT USING (is_member(workspace_id));

CREATE POLICY "workspace_limits_manage" ON public.workspace_limits
  FOR ALL USING (is_master() OR is_member(workspace_id, 'ADMIN'::org_role));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connection_secrets_updated_at
  BEFORE UPDATE ON public.connection_secrets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_limits_updated_at
  BEFORE UPDATE ON public.workspace_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default workspace limit
INSERT INTO public.workspace_limits (workspace_id, connection_limit)
VALUES ('00000000-0000-0000-0000-000000000000', 1)
ON CONFLICT (workspace_id) DO NOTHING;