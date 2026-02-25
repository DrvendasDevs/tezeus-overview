-- Adicionar campo ignore_business_hours na tabela crm_column_automations
-- Este campo permite que automações específicas ignorem a restrição de horário de funcionamento

ALTER TABLE public.crm_column_automations 
ADD COLUMN IF NOT EXISTS ignore_business_hours BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.crm_column_automations.ignore_business_hours 
IS 'Se true, a automação será executada mesmo fora do horário de funcionamento do workspace';

-- Criar índice para otimizar queries que filtram por este campo
CREATE INDEX IF NOT EXISTS idx_crm_column_automations_ignore_business_hours 
ON public.crm_column_automations(ignore_business_hours) 
WHERE ignore_business_hours = true;

