-- Adicionar coluna quoted_message na tabela messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS quoted_message JSONB;