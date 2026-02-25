-- Adicionar campo is_active na tabela loss_reasons
ALTER TABLE public.loss_reasons 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Atualizar registros existentes para manter compatibilidade (todos ativos por padrão)
UPDATE public.loss_reasons 
SET is_active = true 
WHERE is_active IS NULL;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.loss_reasons.is_active IS 'Indica se o motivo de perda está ativo ou inativo';

