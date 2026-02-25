BEGIN;

-- Adicionar coluna para armazenar ID do evento Google Calendar
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_activities_google_calendar_event_id 
ON public.activities(google_calendar_event_id) 
WHERE google_calendar_event_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.activities.google_calendar_event_id IS 'ID do evento criado no Google Calendar. NULL se o evento não foi criado ou o usuário não tem Google Calendar autorizado.';

COMMIT;

