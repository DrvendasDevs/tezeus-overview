-- Habilitar Realtime na tabela messages para receber updates de status em tempo real
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Garantir que a tabela messages está na publicação do Realtime
-- (isso pode dar erro se já estiver adicionada, mas é seguro executar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;