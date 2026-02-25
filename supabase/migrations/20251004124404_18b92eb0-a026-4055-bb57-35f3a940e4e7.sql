-- Configurar REPLICA IDENTITY FULL para conversations
-- Isso garante que todos os dados da linha sejam enviados nos eventos UPDATE do Realtime
ALTER TABLE public.conversations REPLICA IDENTITY FULL;