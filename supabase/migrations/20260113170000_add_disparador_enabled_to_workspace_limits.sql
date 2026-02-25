-- Adiciona flag de produto (Disparador) por empresa/workspace
-- Regra:
-- - Workspaces existentes ficam habilitados (true) para não quebrar clientes atuais
-- - Workspaces novos ficam desabilitados por padrão (DEFAULT false)

ALTER TABLE IF EXISTS public.workspace_limits
  ADD COLUMN IF NOT EXISTS disparador_enabled boolean;

UPDATE public.workspace_limits
SET disparador_enabled = true
WHERE disparador_enabled IS NULL;

ALTER TABLE public.workspace_limits
  ALTER COLUMN disparador_enabled SET DEFAULT false;

ALTER TABLE public.workspace_limits
  ALTER COLUMN disparador_enabled SET NOT NULL;

