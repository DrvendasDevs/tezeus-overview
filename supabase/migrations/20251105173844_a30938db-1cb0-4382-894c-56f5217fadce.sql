-- Criar tabela de logs de ações de provider
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'zapi')),
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'error')),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_provider_logs_workspace 
  ON public.whatsapp_provider_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_provider_logs_created 
  ON public.whatsapp_provider_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_provider_logs_provider 
  ON public.whatsapp_provider_logs(provider);