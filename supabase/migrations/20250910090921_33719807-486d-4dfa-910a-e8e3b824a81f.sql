-- Criar tabela para armazenar webhooks por workspace (se não existir)
CREATE TABLE IF NOT EXISTS public.workspace_webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  secret_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, secret_name)
);

-- RLS para a tabela
ALTER TABLE public.workspace_webhook_secrets ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso apenas por service role e admin do workspace
CREATE POLICY "workspace_webhook_secrets_service_and_admin"
ON public.workspace_webhook_secrets
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role' OR
  is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role' OR
  is_workspace_member(workspace_id, 'admin'::system_profile)
);