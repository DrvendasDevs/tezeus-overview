-- Adicionar coluna is_default na tabela connections
ALTER TABLE public.connections 
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Criar índice único parcial para garantir apenas uma conexão padrão por workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_one_default_per_workspace 
ON public.connections(workspace_id) 
WHERE is_default = true;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.connections.is_default IS 'Indica se esta conexão é a conexão padrão do workspace. Apenas uma conexão pode ser padrão por workspace.';

-- Backfill: Marcar a primeira conexão criada de cada workspace como padrão
-- (apenas se não houver nenhuma conexão já marcada como padrão)
UPDATE public.connections c1
SET is_default = true
WHERE c1.id IN (
  SELECT DISTINCT ON (c2.workspace_id) c2.id
  FROM public.connections c2
  WHERE NOT EXISTS (
    SELECT 1 
    FROM public.connections c3 
    WHERE c3.workspace_id = c2.workspace_id 
    AND c3.is_default = true
  )
  ORDER BY c2.workspace_id, c2.created_at ASC
);

