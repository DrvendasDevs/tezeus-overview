-- Adicionar campos necessários às tabelas existentes
-- Tabela conversations: adicionar canal e agente_ativo
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS canal TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS agente_ativo BOOLEAN DEFAULT true;

-- Tabela messages: adicionar origem_resposta
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS origem_resposta TEXT DEFAULT 'manual';

-- Atualizar registros existentes para manter compatibilidade
UPDATE public.conversations 
SET canal = 'whatsapp', agente_ativo = true 
WHERE canal IS NULL OR agente_ativo IS NULL;

UPDATE public.messages 
SET origem_resposta = 'manual' 
WHERE origem_resposta IS NULL;