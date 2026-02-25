-- Adicionar foreign keys para estabelecer relacionamentos
ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_contact_id 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_queue_id 
FOREIGN KEY (queue_id) REFERENCES public.queues(id) ON DELETE SET NULL;

ALTER TABLE public.messages 
ADD CONSTRAINT fk_messages_conversation_id 
FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

-- Adicionar trigger para atualizar unread_count quando nova mensagem é inserida
CREATE TRIGGER update_conversation_unread_count_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_unread_count();