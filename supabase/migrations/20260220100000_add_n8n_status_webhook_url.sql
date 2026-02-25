-- Migration: Adicionar campo n8n_status_webhook_url na tabela whatsapp_providers
-- Este campo armazena a URL do webhook N8N para callbacks de status de mensagens
-- Anteriormente essa URL estava hardcoded na função zapi-webhook

ALTER TABLE whatsapp_providers
ADD COLUMN IF NOT EXISTS n8n_status_webhook_url TEXT;

COMMENT ON COLUMN whatsapp_providers.n8n_status_webhook_url IS 'URL do webhook N8N para receber callbacks de status de mensagens (delivered, read, etc)';
