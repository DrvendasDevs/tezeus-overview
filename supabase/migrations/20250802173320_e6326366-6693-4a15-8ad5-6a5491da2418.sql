-- Limpar file_name problemáticos nas mensagens existentes
UPDATE public.messages 
SET file_name = CASE 
  WHEN file_name LIKE '%.ogg; codecs=opus' THEN REPLACE(file_name, '; codecs=opus', '')
  WHEN file_name LIKE '%.mp4; codecs=%' THEN SPLIT_PART(file_name, ';', 1)
  WHEN file_name LIKE '%.webp; %' THEN SPLIT_PART(file_name, ';', 1)
  WHEN file_name LIKE '%.jpeg; %' THEN SPLIT_PART(file_name, ';', 1)
  ELSE file_name
END
WHERE file_name LIKE '%; %' 
  AND message_type IN ('audio', 'video', 'image', 'document');

-- Atualizar file_url problemáticas que contêm caracteres especiais
UPDATE public.messages 
SET file_url = REPLACE(file_url, '%20codecs=opus', '')
WHERE file_url LIKE '%codecs=opus%' 
  AND message_type IN ('audio', 'video', 'image', 'document');