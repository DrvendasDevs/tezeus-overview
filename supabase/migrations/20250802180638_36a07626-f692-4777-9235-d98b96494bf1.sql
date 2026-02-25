-- Corrigir função trigger_ai_response para fazer JOIN correto com contacts
CREATE OR REPLACE FUNCTION public.trigger_ai_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Verificar se é mensagem de contato em conversa com agente ativo
  IF NEW.sender_type = 'contact' AND NEW.message_type = 'text' THEN
    -- Buscar informações da conversa
    DECLARE
      conversation_rec RECORD;
    BEGIN
      -- JOIN correto para pegar phone da tabela contacts
      SELECT c.agente_ativo, c.canal, ct.phone 
      INTO conversation_rec
      FROM public.conversations c
      JOIN public.contacts ct ON c.contact_id = ct.id
      WHERE c.id = NEW.conversation_id;
      
      -- Se agente está ativo, acionar IA
      IF conversation_rec.agente_ativo = true THEN
        -- Usar pg_net para chamar a função de IA de forma assíncrona
        PERFORM
          net.http_post(
            url := current_setting('app.supabase_url') || '/functions/v1/ai-chat-response',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
            ),
            body := jsonb_build_object(
              'messageId', NEW.id,
              'conversationId', NEW.conversation_id,
              'content', NEW.content,
              'phoneNumber', conversation_rec.phone
            )
          );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;