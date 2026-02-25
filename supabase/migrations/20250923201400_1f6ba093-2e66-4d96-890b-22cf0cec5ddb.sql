-- Adicionar campo permissions na tabela pipeline_columns
ALTER TABLE public.pipeline_columns 
ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.pipeline_columns.permissions IS 'Array de user_ids que podem ver os cards desta coluna. Array vazio significa que todos podem ver.';