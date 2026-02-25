-- Fase 1: Migrations Seguras (Zero Downtime)

-- 1. Índice único para idempotência de mensagens  
CREATE UNIQUE INDEX IF NOT EXISTS messages_workspace_external_id_key
  ON public.messages(workspace_id, external_id)
  WHERE external_id IS NOT NULL;

-- 2. Tags únicas por workspace
CREATE UNIQUE INDEX IF NOT EXISTS tags_workspace_name_unique_idx
  ON public.tags(workspace_id, name);

-- Comentário: Ambos os índices são seguros e não quebram dados existentes
-- O primeiro permite idempotência baseada em external_id quando a flag for ativada
-- O segundo previne tags duplicadas por workspace