-- Adicionar coluna pipeline_card_id à tabela activities
ALTER TABLE public.activities 
ADD COLUMN pipeline_card_id uuid REFERENCES public.pipeline_cards(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance de queries
CREATE INDEX idx_activities_pipeline_card_id ON public.activities(pipeline_card_id);

-- Comentário explicativo
COMMENT ON COLUMN public.activities.pipeline_card_id IS 'ID do negócio (pipeline card) ao qual esta atividade pertence. NULL = atividade global do contato.';