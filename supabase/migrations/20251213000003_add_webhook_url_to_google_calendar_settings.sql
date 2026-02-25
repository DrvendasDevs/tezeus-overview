BEGIN;

-- Adicionar coluna webhook_url na tabela system_google_calendar_settings
ALTER TABLE public.system_google_calendar_settings 
ADD COLUMN IF NOT EXISTS webhook_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.system_google_calendar_settings.webhook_url IS 'URL do webhook N8N global para processar eventos do Google Calendar. Usada como fallback quando workspace não tem webhook específico configurado.';

COMMIT;

