-- Habilitar realtime para tabelas usadas pelas automações

-- 1. Habilitar REPLICA IDENTITY FULL para capturar todos os dados em updates
ALTER TABLE public.contact_tags REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 2. Adicionar tabelas à publicação realtime (se ainda não estiverem)
DO $$
BEGIN
  -- Adicionar contact_tags
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'contact_tags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_tags;
  END IF;
  
  -- Adicionar conversations (caso não esteja)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;