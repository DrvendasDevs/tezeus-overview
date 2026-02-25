-- Adicionar campo client_token na tabela whatsapp_providers
ALTER TABLE public.whatsapp_providers 
ADD COLUMN IF NOT EXISTS zapi_client_token TEXT;