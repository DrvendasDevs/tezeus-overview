-- Habilitar REPLICA IDENTITY FULL para capturar todos os campos em UPDATE events
ALTER TABLE public.messages REPLICA IDENTITY FULL;