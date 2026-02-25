-- Criar tabela para logs de performance dos provedores WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'zapi')),
  action TEXT NOT NULL CHECK (action IN ('send_message', 'test_connection')),
  result TEXT NOT NULL CHECK (result IN ('success', 'error')),
  response_time_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para otimizar consultas
CREATE INDEX idx_provider_logs_workspace ON public.whatsapp_provider_logs(workspace_id);
CREATE INDEX idx_provider_logs_provider ON public.whatsapp_provider_logs(provider);
CREATE INDEX idx_provider_logs_created_at ON public.whatsapp_provider_logs(created_at DESC);
CREATE INDEX idx_provider_logs_result ON public.whatsapp_provider_logs(result);

-- RLS Policies
ALTER TABLE public.whatsapp_provider_logs ENABLE ROW LEVEL SECURITY;

-- Policy para masters verem tudo
CREATE POLICY "Masters can view all provider logs"
  ON public.whatsapp_provider_logs
  FOR SELECT
  USING (public.is_current_user_master());

-- Policy para workspace members verem logs do próprio workspace
CREATE POLICY "Workspace members can view their workspace provider logs"
  ON public.whatsapp_provider_logs
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'user'));

-- Policy para inserção (apenas edge functions)
CREATE POLICY "Service role can insert provider logs"
  ON public.whatsapp_provider_logs
  FOR INSERT
  WITH CHECK (true);