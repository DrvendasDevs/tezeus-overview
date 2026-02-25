-- Habilitar REPLICA IDENTITY FULL para capturar todas as mudanças
ALTER TABLE public.conversation_agent_history REPLICA IDENTITY FULL;
ALTER TABLE public.pipeline_card_history REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_agent_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_card_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;