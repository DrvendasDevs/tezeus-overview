-- Criar função que aciona automaticamente a IA para resposta
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
      SELECT agente_ativo, phone_number, canal 
      INTO conversation_rec
      FROM public.conversations 
      WHERE id = NEW.conversation_id;
      
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
              'phoneNumber', conversation_rec.phone_number
            )
          );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger que executa após inserção de mensagem
DROP TRIGGER IF EXISTS trigger_ai_response_on_message ON public.messages;
CREATE TRIGGER trigger_ai_response_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_ai_response();