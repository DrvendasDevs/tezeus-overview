BEGIN;

-- Adicionar coluna opcional para webhook específico do Google Calendar
ALTER TABLE public.workspace_webhook_settings 
ADD COLUMN IF NOT EXISTS google_calendar_webhook_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.workspace_webhook_settings.google_calendar_webhook_url IS 'URL do webhook N8N específico para processar eventos do Google Calendar. Se NULL, usa webhook_url padrão.';

COMMIT;

