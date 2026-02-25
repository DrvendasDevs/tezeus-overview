-- Adicionar coluna mime_type se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'mime_type') THEN
    ALTER TABLE public.messages ADD COLUMN mime_type TEXT;
  END IF;
END $$;

-- Criar bucket de storage para mídias do chat se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas para o bucket chat-media se não existirem
DO $$ 
BEGIN
  -- Política de leitura pública
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow public access to chat-media') THEN
    EXECUTE 'CREATE POLICY "Allow public access to chat-media" ON storage.objects
    FOR SELECT USING (bucket_id = ''chat-media'')';
  END IF;
  
  -- Política de upload
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow upload to chat-media') THEN
    EXECUTE 'CREATE POLICY "Allow upload to chat-media" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = ''chat-media'')';
  END IF;
  
  -- Política de update
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow update to chat-media') THEN
    EXECUTE 'CREATE POLICY "Allow update to chat-media" ON storage.objects
    FOR UPDATE USING (bucket_id = ''chat-media'')';
  END IF;
  
  -- Política de delete
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Allow delete from chat-media') THEN
    EXECUTE 'CREATE POLICY "Allow delete from chat-media" ON storage.objects
    FOR DELETE USING (bucket_id = ''chat-media'')';
  END IF;
END $$;