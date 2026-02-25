-- Configurar REPLICA IDENTITY FULL para a tabela conversations
-- Isso garante que eventos UPDATE incluam todos os dados da linha, não apenas as chaves
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Verificar se a tabela já está na publicação realtime (deve estar)
-- Esta consulta apenas verifica, não modifica nada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
    -- Adicionar à publicação se não estiver
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;