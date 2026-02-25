-- Corrigir políticas RLS para acesso público ao bucket whatsapp-media

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Allow public access to whatsapp-media bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload to whatsapp-media" ON storage.objects;

-- Criar políticas para acesso público completo ao bucket whatsapp-media
CREATE POLICY "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Public insert access for whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Public update access for whatsapp-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Public delete access for whatsapp-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media');