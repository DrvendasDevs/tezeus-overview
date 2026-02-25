-- Fix messages sender_type constraint to include 'user'
ALTER TABLE public.messages 
DROP CONSTRAINT IF EXISTS messages_sender_type_check;

-- Add updated constraint that includes 'user'
ALTER TABLE public.messages 
ADD CONSTRAINT messages_sender_type_check 
CHECK (sender_type IN ('contact', 'user', 'agent', 'system'));