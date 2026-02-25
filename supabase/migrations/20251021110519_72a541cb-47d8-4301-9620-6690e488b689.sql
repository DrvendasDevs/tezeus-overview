-- Adiciona coluna workspace_id na tabela ai_agents para vincular agentes a workspaces específicos
ALTER TABLE public.ai_agents 
ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance de queries por workspace
CREATE INDEX idx_ai_agents_workspace_id ON public.ai_agents(workspace_id);

-- Comentário descrevendo a coluna
COMMENT ON COLUMN public.ai_agents.workspace_id IS 'Workspace ao qual o agente está vinculado. NULL significa agente global/master.';