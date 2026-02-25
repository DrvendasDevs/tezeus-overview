-- Migração: Backfill provider_id nas conexões existentes e adicionar constraint

-- 1. Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_connections_provider_id ON public.connections(provider_id);

-- 2. Backfill: Vincular conexões existentes ao provider Evolution ativo de cada workspace
UPDATE public.connections c
SET provider_id = (
  SELECT wp.id 
  FROM public.whatsapp_providers wp
  WHERE wp.workspace_id = c.workspace_id 
    AND wp.provider = 'evolution' 
    AND wp.is_active = true
  ORDER BY wp.created_at ASC
  LIMIT 1
)
WHERE c.provider_id IS NULL;

-- 3. Adicionar comentário explicativo na coluna
COMMENT ON COLUMN public.connections.provider_id IS 'FK para whatsapp_providers - indica qual provider foi usado para criar esta instância';