
-- Habilitar REPLICA IDENTITY FULL para capturar todas as mudanças em tempo real
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
