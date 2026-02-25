-- Corrigir warnings de segurança: definir search_path nas funções

-- 1. Corrigir função update_conversation_unread_count
CREATE OR REPLACE FUNCTION public.update_conversation_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a mensagem é de um contato, incrementar unread_count
  IF NEW.sender_type = 'contact' THEN
    UPDATE public.conversations 
    SET 
      unread_count = unread_count + 1,
      last_activity_at = NEW.created_at,
      updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  ELSE
    -- Se é resposta do agente, resetar unread_count (conversa foi atendida)
    UPDATE public.conversations 
    SET 
      unread_count = 0,
      last_activity_at = NEW.created_at,
      updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Corrigir função reopen_conversation_on_new_message
CREATE OR REPLACE FUNCTION public.reopen_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Se mensagem é de contato e conversa está fechada, reabrir
  IF NEW.sender_type = 'contact' THEN
    UPDATE public.conversations 
    SET status = 'open'
    WHERE id = NEW.conversation_id AND status = 'closed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';