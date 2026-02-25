-- Remove duplicate foreign key constraint between messages and conversations
-- Keeping only fk_messages_conversation_id and removing messages_conversation_id_fkey

ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;