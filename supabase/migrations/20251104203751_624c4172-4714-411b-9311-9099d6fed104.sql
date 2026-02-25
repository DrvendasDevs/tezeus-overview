-- Atualizar bucket whatsapp-media para aceitar todos os tipos de documentos
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  -- Imagens
  'image/jpeg', 
  'image/png', 
  'image/gif', 
  'image/webp',
  -- Vídeos
  'video/mp4', 
  'video/quicktime',
  -- Áudios
  'audio/mpeg', 
  'audio/wav', 
  'audio/webm',
  -- Documentos PDF
  'application/pdf',
  -- Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  -- Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  -- PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  -- Texto
  'text/plain',
  -- Fallback genérico
  'application/octet-stream'
]
WHERE id = 'whatsapp-media';