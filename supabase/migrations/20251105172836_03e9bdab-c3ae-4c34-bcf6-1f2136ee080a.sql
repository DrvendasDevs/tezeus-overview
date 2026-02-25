-- Criar tabela de provedores WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'zapi')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Evolution
  evolution_url TEXT,
  evolution_token TEXT,
  
  -- Z-API
  zapi_url TEXT,
  zapi_token TEXT,
  
  -- N8N
  n8n_webhook_url TEXT,
  
  -- Flags
  enable_fallback BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice único: apenas um provedor ativo por workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_provider_active_per_ws
  ON public.whatsapp_providers(workspace_id)
  WHERE is_active = true;

-- Índice para busca rápida por workspace
CREATE INDEX IF NOT EXISTS idx_whatsapp_providers_ws 
  ON public.whatsapp_providers(workspace_id);

-- RLS: Seguir padrão do sistema
ALTER TABLE public.whatsapp_providers ENABLE ROW LEVEL SECURITY;

-- Masters podem tudo
CREATE POLICY "whatsapp_providers_master_all"
  ON public.whatsapp_providers
  FOR ALL
  TO authenticated
  USING (is_current_user_master())
  WITH CHECK (is_current_user_master());

-- Admins do workspace podem gerenciar
CREATE POLICY "whatsapp_providers_admin_manage"
  ON public.whatsapp_providers
  FOR ALL
  TO authenticated
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Users do workspace podem ler apenas o provedor ativo
CREATE POLICY "whatsapp_providers_user_read_active"
  ON public.whatsapp_providers
  FOR SELECT
  TO authenticated
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile) 
    AND is_active = true
  );

-- Migrar credenciais Evolution existentes
INSERT INTO public.whatsapp_providers (
  workspace_id, 
  provider, 
  is_active, 
  evolution_url, 
  evolution_token,
  n8n_webhook_url
)
SELECT DISTINCT 
  eit.workspace_id,
  'evolution'::TEXT,
  true,
  eit.evolution_url,
  eit.token,
  wws.webhook_url
FROM public.evolution_instance_tokens eit
LEFT JOIN public.workspace_webhook_settings wws ON wws.workspace_id = eit.workspace_id
WHERE eit.instance_name = '_master_config'
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_providers wp 
    WHERE wp.workspace_id = eit.workspace_id
  )
ON CONFLICT DO NOTHING;

-- Adicionar coluna provider_id em connections
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.whatsapp_providers(id) ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_connections_provider_id 
  ON public.connections(provider_id);

-- Vincular connections existentes ao provider Evolution ativo
UPDATE public.connections c
SET provider_id = (
  SELECT wp.id 
  FROM public.whatsapp_providers wp 
  WHERE wp.workspace_id = c.workspace_id 
    AND wp.provider = 'evolution' 
    AND wp.is_active = true
  LIMIT 1
)
WHERE c.provider_id IS NULL;