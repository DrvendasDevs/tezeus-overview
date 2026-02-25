-- Deletar mensagens de áudio com URLs problemáticas/expiradas do WhatsApp
DELETE FROM public.messages 
WHERE message_type = 'audio' 
  AND (
    file_url LIKE '%mmg.whatsapp.net%' OR
    file_url LIKE '%whatsapp.net%' OR
    file_url LIKE '%codecs=%' OR
    file_url LIKE '%.enc?%'
  );