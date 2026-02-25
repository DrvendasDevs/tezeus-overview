-- Criar função para atualizar conversa quando mensagem é inserida
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  last_msg_content text;
  last_msg_type text;
BEGIN
  -- Obter conteúdo da última mensagem para mostrar no card
  SELECT content, message_type INTO last_msg_content, last_msg_type
  FROM public.messages 
  WHERE conversation_id = NEW.conversation_id 
  ORDER BY created_at DESC 
  LIMIT 1;

  -- Atualizar a conversa com nova atividade e dados da última mensagem
  UPDATE public.conversations 
  SET 
    last_activity_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'contact' THEN unread_count + 1
      ELSE 0  -- Reset unread quando agente responde
    END
  WHERE id = NEW.conversation_id;
  
  -- Log para debug
  RAISE NOTICE 'Conversa % atualizada por nova mensagem % (tipo: %)', 
    NEW.conversation_id, NEW.id, NEW.sender_type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar trigger que executa após inserção de mensagem
DROP TRIGGER IF EXISTS update_conversation_on_message_insert ON public.messages;
CREATE TRIGGER update_conversation_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();

-- Recriar trigger existente para reabrir conversa se necessário
DROP TRIGGER IF EXISTS reopen_conversation_trigger ON public.messages;
CREATE TRIGGER reopen_conversation_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reopen_conversation_on_new_message();