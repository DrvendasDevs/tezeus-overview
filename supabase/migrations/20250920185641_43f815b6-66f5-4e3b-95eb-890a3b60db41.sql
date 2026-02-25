-- Fix constraint to allow 'document' message type
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add updated constraint with all supported message types
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'contact', 'location'));