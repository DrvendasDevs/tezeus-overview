-- Garantir REPLICA IDENTITY FULL para capturar todos os dados nas mudanças realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;