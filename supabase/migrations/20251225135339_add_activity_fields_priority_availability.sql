-- Adicionar colunas priority e availability na tabela activities
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta')),
ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'livre' CHECK (availability IN ('livre', 'ocupado'));

-- Criar índice para melhorar performance em consultas por prioridade
CREATE INDEX IF NOT EXISTS idx_activities_priority ON public.activities(priority);
CREATE INDEX IF NOT EXISTS idx_activities_availability ON public.activities(availability);

