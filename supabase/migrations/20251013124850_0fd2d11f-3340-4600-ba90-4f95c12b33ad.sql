
-- Corrigir unread_count de todas as conversas existentes
UPDATE public.conversations 
SET unread_count = (
  SELECT COUNT(*) 
  FROM public.messages m 
  WHERE m.conversation_id = conversations.id 
  AND m.sender_type = 'contact' 
  AND m.read_at IS NULL
)
WHERE workspace_id = 'afc5af73-0979-4bbc-9101-c505210ad4f3';
