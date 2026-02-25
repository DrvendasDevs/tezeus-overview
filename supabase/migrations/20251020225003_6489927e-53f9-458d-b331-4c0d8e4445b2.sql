-- Adicionar coluna user_limit na tabela workspace_limits
ALTER TABLE public.workspace_limits 
ADD COLUMN IF NOT EXISTS user_limit INTEGER NOT NULL DEFAULT 5;

-- Comentário explicativo
COMMENT ON COLUMN public.workspace_limits.user_limit IS 'Limite de usuários que podem ser criados neste workspace';