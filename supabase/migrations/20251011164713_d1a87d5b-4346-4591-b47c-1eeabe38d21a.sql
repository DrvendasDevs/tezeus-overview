-- Habilitar REPLICA IDENTITY FULL para capturar dados completos nas mudanças
ALTER TABLE public.pipeline_cards REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_columns REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_columns;