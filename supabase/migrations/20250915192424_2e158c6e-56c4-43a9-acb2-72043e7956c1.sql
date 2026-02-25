-- Corrigir URLs de webhook que estão apontando para endpoints de teste
UPDATE workspace_webhook_settings 
SET webhook_url = REPLACE(webhook_url, '/webhook-test/', '/webhook/')
WHERE webhook_url LIKE '%/webhook-test/%';