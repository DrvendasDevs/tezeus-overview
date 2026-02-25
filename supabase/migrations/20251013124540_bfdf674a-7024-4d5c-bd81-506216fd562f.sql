-- Corrigir o trigger para só recalcular quando for mensagem de contato
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  last_msg_content text;
  last_msg_type text;
  new_unread_count integer;
BEGIN
  -- Obter conteúdo da última mensagem para mostrar no card
  SELECT content, message_type INTO last_msg_content, last_msg_type
  FROM public.messages 
  WHERE conversation_id = NEW.conversation_id 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Calcular o total real de mensagens não lidas (apenas de contato e não lidas)
  SELECT COUNT(*) INTO new_unread_count
  FROM public.messages
  WHERE conversation_id = NEW.conversation_id
    AND sender_type = 'contact'
    AND read_at IS NULL;

  -- Atualizar a conversa
  -- Se a nova mensagem é do agente, resetar unread_count para 0
  -- Se é do contato, usar o valor calculado
  UPDATE public.conversations 
  SET 
    last_activity_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'agent' OR NEW.sender_type = 'system' THEN 0
      ELSE new_unread_count
    END
  WHERE id = NEW.conversation_id;
  
  -- Log para debug
  RAISE NOTICE 'Conversa % atualizada - sender_type: %, unread_count: %', 
    NEW.conversation_id, NEW.sender_type, 
    CASE WHEN NEW.sender_type = 'agent' OR NEW.sender_type = 'system' THEN 0 ELSE new_unread_count END;
  
  RETURN NEW;
END;
$function$;