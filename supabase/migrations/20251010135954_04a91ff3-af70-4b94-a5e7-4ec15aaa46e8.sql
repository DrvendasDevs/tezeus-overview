-- Add evolution_key_id column to messages table
-- This column will store the 40-character keyId from Evolution API
-- while external_id stores the 22-character key.id
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS evolution_key_id TEXT;

-- Create index for fast lookups on evolution_key_id
CREATE INDEX IF NOT EXISTS idx_messages_evolution_key_id 
ON messages(evolution_key_id) 
WHERE evolution_key_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN messages.evolution_key_id IS 'Stores the 40-character keyId from Evolution API messages.update events. Different from external_id which stores the 22-character key.id from messages.upsert events.';