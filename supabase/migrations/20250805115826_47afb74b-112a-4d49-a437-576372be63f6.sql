-- Primeiro, vamos garantir que temos os triggers corretos para atualizar unread_count
-- e reordenar conversas automaticamente por atividade

-- 1. Trigger para atualizar unread_count quando nova mensagem é inserida
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar trigger para executar a função quando mensagens são inseridas
DROP TRIGGER IF EXISTS trigger_update_conversation_unread_count ON public.messages;
CREATE TRIGGER trigger_update_conversation_unread_count
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_unread_count();

-- 3. Trigger para reabrir conversas fechadas quando nova mensagem de contato chega
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar trigger para reabrir conversas
DROP TRIGGER IF EXISTS trigger_reopen_conversation ON public.messages;
CREATE TRIGGER trigger_reopen_conversation
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.reopen_conversation_on_new_message();

-- 5. Habilitar real-time nas tabelas
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 6. Adicionar tabelas à publicação do realtime
DO $$
BEGIN
  -- Verificar se as tabelas já estão na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;