-- Primeiro, vamos recalcular todos os contadores de mensagens não lidas atuais
UPDATE public.conversations c
SET unread_count = (
  SELECT COUNT(*)
  FROM public.messages m
  WHERE m.conversation_id = c.id
    AND m.sender_type = 'contact'
    AND m.read_at IS NULL
);

-- Agora vamos corrigir a função trigger para calcular o total real ao invés de incrementar
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

  -- Atualizar a conversa com nova atividade e contagem correta
  UPDATE public.conversations 
  SET 
    last_activity_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = new_unread_count
  WHERE id = NEW.conversation_id;
  
  -- Log para debug
  RAISE NOTICE 'Conversa % atualizada - unread_count recalculado: % (mensagem tipo: %)', 
    NEW.conversation_id, new_unread_count, NEW.sender_type;
  
  RETURN NEW;
END;
$function$;