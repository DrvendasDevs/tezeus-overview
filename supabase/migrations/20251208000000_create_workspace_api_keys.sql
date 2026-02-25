-- Criar tabela para armazenar API Keys por workspace
CREATE TABLE IF NOT EXISTS public.workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Criar índice único para workspace_id + api_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_api_keys_workspace_api_key 
ON public.workspace_api_keys(workspace_id, api_key);

-- Criar índice para busca rápida por api_key
CREATE INDEX IF NOT EXISTS idx_workspace_api_keys_api_key 
ON public.workspace_api_keys(api_key) 
WHERE is_active = true;

-- Desabilitar RLS (acesso apenas via service_role)
ALTER TABLE public.workspace_api_keys DISABLE ROW LEVEL SECURITY;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_workspace_api_keys_updated_at
  BEFORE UPDATE ON public.workspace_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.workspace_api_keys IS 'Armazena API Keys para acesso externo à API de webhooks';
COMMENT ON COLUMN public.workspace_api_keys.api_key IS 'Chave de API em texto plano (pode ser criptografada no futuro)';
COMMENT ON COLUMN public.workspace_api_keys.name IS 'Nome/descrição da chave para identificação';
COMMENT ON COLUMN public.workspace_api_keys.is_active IS 'Indica se a chave está ativa e pode ser usada';
COMMENT ON COLUMN public.workspace_api_keys.last_used_at IS 'Última vez que a chave foi utilizada';

