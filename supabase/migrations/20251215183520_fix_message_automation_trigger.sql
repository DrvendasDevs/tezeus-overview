-- Corrigir trigger de automações de mensagem recebida
-- Adicionar phoneNumber ao payload e melhorar a busca de dados

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
  contact_phone text;
  contact_id_val uuid;
BEGIN
  -- Apenas processar mensagens de contato (incoming)
  IF NEW.sender_type != 'contact' THEN
    RETURN NEW;
  END IF;

  -- Buscar contact_id e phone da conversa
  SELECT c.contact_id, ct.phone
  INTO contact_id_val, contact_phone
  FROM conversations c
  LEFT JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.id = NEW.conversation_id;

  -- Se não encontrou contato, não processar
  IF contact_id_val IS NULL THEN
    RAISE NOTICE '⚠️ Trigger message automation: Contact not found for conversation %', NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- Buscar as variáveis de ambiente
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Se não encontrou, usar valores padrão (serão configurados depois)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://zldeaozqxjwvzgrblyrh.supabase.co';
  END IF;

  -- Construir payload completo com phoneNumber
  payload := jsonb_build_object(
    'contactId', contact_id_val,
    'conversationId', NEW.conversation_id,
    'workspaceId', NEW.workspace_id,
    'phoneNumber', contact_phone,
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

  RAISE NOTICE '🔔 Triggered check-message-automations for message % in conversation % (contact: %, phone: %)', 
    NEW.id, NEW.conversation_id, contact_id_val, contact_phone;
  
  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trigger_message_automations_on_insert ON public.messages;
CREATE TRIGGER trigger_message_automations_on_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'contact')
  EXECUTE FUNCTION public.trigger_message_automations();

