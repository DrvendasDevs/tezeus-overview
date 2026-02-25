-- Remover políticas restritivas e criar uma mais simples
DROP POLICY IF EXISTS "Allow media uploads" ON storage.objects;

-- Criar política mais simples para teste
CREATE POLICY "Allow whatsapp media uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'whatsapp-media');

-- Verificar se o bucket está público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'whatsapp-media';