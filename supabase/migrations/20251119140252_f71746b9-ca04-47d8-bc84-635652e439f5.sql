-- Adicionar coluna default_pipeline_id na tabela workspaces
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS default_pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_workspaces_default_pipeline 
ON public.workspaces(default_pipeline_id);

COMMENT ON COLUMN public.workspaces.default_pipeline_id IS 'Pipeline padrão que aparecerá primeiro no workspace';