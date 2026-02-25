-- Criar função que chama check-message-automations via pg_net
CREATE OR REPLACE FUNCTION public.trigger_message_automations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  payload jsonb;
BEGIN
  -- Apenas processar mensagens de contato (incoming)
  IF NEW.sender_type != 'contact' THEN
    RETURN NEW;
  END IF;

  -- Buscar as variáveis de ambiente
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Se não encontrou, usar valores padrão (serão configurados depois)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://zldeaozqxjwvzgrblyrh.supabase.co';
  END IF;

  -- Construir payload
  payload := jsonb_build_object(
    'contactId', (SELECT contact_id FROM conversations WHERE id = NEW.conversation_id),
    'conversationId', NEW.conversation_id,
    'workspaceId', NEW.workspace_id,
    'messageId', NEW.id
  );

  -- Chamar edge function de forma assíncrona usando pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-message-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  RAISE NOTICE '🔔 Triggered check-message-automations for message % in conversation %', NEW.id, NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Criar trigger que dispara após INSERT de nova mensagem
DROP TRIGGER IF EXISTS trigger_message_automations_on_insert ON public.messages;
CREATE TRIGGER trigger_message_automations_on_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_automations();