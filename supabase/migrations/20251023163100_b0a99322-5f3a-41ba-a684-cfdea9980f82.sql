-- Garantir que REPLICA IDENTITY FULL está ativo
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;