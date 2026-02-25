-- Corrigir função com search_path seguro
CREATE OR REPLACE FUNCTION update_conversation_unread_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Incrementar contador quando nova mensagem de contato chega
  IF NEW.sender_type = 'contact' THEN
    UPDATE public.conversations 
    SET unread_count = unread_count + 1,
        last_activity_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  ELSE
    -- Resetar contador quando agente responde
    UPDATE public.conversations 
    SET unread_count = 0,
        last_activity_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$;