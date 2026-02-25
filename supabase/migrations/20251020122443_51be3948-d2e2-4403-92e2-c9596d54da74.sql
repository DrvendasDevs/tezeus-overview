-- Adicionar coluna reply_to_message_id na tabela messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;