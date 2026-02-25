-- Corrigir o trigger para fazer incremento ao invés de count total
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se a nova mensagem é de um contato, incrementar unread_count
  IF NEW.sender_type = 'contact' THEN
    UPDATE public.conversations 
    SET 
      unread_count = unread_count + 1,
      last_activity_at = NEW.created_at,
      updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  ELSE
    -- Se é resposta do agente/system, resetar unread_count (conversa foi atendida)
    UPDATE public.conversations 
    SET 
      unread_count = 0,
      last_activity_at = NEW.created_at,
      updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  
  -- Log para debug
  RAISE NOTICE 'Conversa % atualizada - sender_type: %, incremento aplicado', 
    NEW.conversation_id, NEW.sender_type;
  
  RETURN NEW;
END;
$function$;