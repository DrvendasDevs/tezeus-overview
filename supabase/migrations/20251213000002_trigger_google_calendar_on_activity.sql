BEGIN;

-- Criar função que chama create-google-calendar-event via pg_net
CREATE OR REPLACE FUNCTION public.trigger_google_calendar_event()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  payload jsonb;
  activity_data jsonb;
BEGIN
  -- Buscar as variáveis de ambiente
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Se não encontrou, usar valores padrão (serão configurados depois)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://zldeaozqxjwvzgrblyrh.supabase.co';
  END IF;

  -- Determinar ação baseado no tipo de trigger
  IF TG_OP = 'DELETE' THEN
    -- Para DELETE, usar dados antigos
    payload := jsonb_build_object(
      'action', 'delete',
      'activity_id', OLD.id,
      'google_event_id', OLD.google_calendar_event_id,
      'workspace_id', OLD.workspace_id,
      'responsible_id', OLD.responsible_id
    );
  ELSE
    -- Para INSERT ou UPDATE, construir dados completos da atividade
    activity_data := jsonb_build_object(
      'id', NEW.id,
      'workspace_id', NEW.workspace_id,
      'responsible_id', NEW.responsible_id,
      'subject', NEW.subject,
      'description', NEW.description,
      'scheduled_for', NEW.scheduled_for,
      'duration_minutes', NEW.duration_minutes,
      'google_calendar_event_id', NEW.google_calendar_event_id,
      'contact_id', NEW.contact_id,
      'pipeline_card_id', NEW.pipeline_card_id
    );

    -- Determinar se é create ou update
    IF TG_OP = 'INSERT' THEN
      payload := jsonb_build_object(
        'action', 'create',
        'activity_data', activity_data
      );
    ELSIF TG_OP = 'UPDATE' THEN
      -- Verificar se campos relevantes mudaram
      IF (
        OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for OR
        OLD.responsible_id IS DISTINCT FROM NEW.responsible_id OR
        OLD.subject IS DISTINCT FROM NEW.subject OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
      ) THEN
        payload := jsonb_build_object(
          'action', 'update',
          'activity_data', activity_data
        );
      ELSE
        -- Nenhum campo relevante mudou, não precisa atualizar Google Calendar
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- Chamar edge function de forma assíncrona usando pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/create-google-calendar-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  IF TG_OP = 'DELETE' THEN
    RAISE NOTICE '🗑️ Triggered delete Google Calendar event for activity %', OLD.id;
    RETURN OLD;
  ELSE
    RAISE NOTICE '📅 Triggered % Google Calendar event for activity %', TG_OP, NEW.id;
    RETURN NEW;
  END IF;
END;
$$;

-- Criar trigger para INSERT
DROP TRIGGER IF EXISTS trigger_google_calendar_on_activity_insert ON public.activities;
CREATE TRIGGER trigger_google_calendar_on_activity_insert
  AFTER INSERT ON public.activities
  FOR EACH ROW
  WHEN (NEW.responsible_id IS NOT NULL AND NEW.scheduled_for IS NOT NULL)
  EXECUTE FUNCTION public.trigger_google_calendar_event();

-- Criar trigger para UPDATE
DROP TRIGGER IF EXISTS trigger_google_calendar_on_activity_update ON public.activities;
CREATE TRIGGER trigger_google_calendar_on_activity_update
  AFTER UPDATE ON public.activities
  FOR EACH ROW
  WHEN (
    NEW.responsible_id IS NOT NULL AND 
    NEW.scheduled_for IS NOT NULL AND
    (
      OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for OR
      OLD.responsible_id IS DISTINCT FROM NEW.responsible_id OR
      OLD.subject IS DISTINCT FROM NEW.subject OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    )
  )
  EXECUTE FUNCTION public.trigger_google_calendar_event();

-- Criar trigger para DELETE
DROP TRIGGER IF EXISTS trigger_google_calendar_on_activity_delete ON public.activities;
CREATE TRIGGER trigger_google_calendar_on_activity_delete
  AFTER DELETE ON public.activities
  FOR EACH ROW
  WHEN (OLD.google_calendar_event_id IS NOT NULL)
  EXECUTE FUNCTION public.trigger_google_calendar_event();

COMMIT;

