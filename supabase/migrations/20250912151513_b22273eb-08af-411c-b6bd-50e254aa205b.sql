-- Verificar e corrigir políticas do bucket whatsapp-media
-- Permitir uploads de todos os tipos de mídia suportados

-- Criar política mais permissiva para uploads de mídia
DROP POLICY IF EXISTS "Allow media uploads" ON storage.objects;

CREATE POLICY "Allow media uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'whatsapp-media' AND 
  (
    -- Permitir tipos de imagem
    (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg')) OR
    -- Permitir tipos de áudio  
    (storage.extension(name) IN ('mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'opus', 'webm')) OR
    -- Permitir tipos de vídeo
    (storage.extension(name) IN ('mp4', 'mov', 'avi', 'mkv', '3gp', 'flv', 'wmv')) OR
    -- Permitir documentos
    (storage.extension(name) IN ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'))
  )
);

-- Permitir acesso público de leitura  
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;

CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'whatsapp-media');