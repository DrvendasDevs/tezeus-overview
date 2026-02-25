-- Add history sync tracking fields to connections table
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS history_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS history_sync_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS history_sync_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS history_messages_synced INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN connections.history_sync_status IS 'Status da sincronização de histórico: pending, syncing, completed, error';
COMMENT ON COLUMN connections.history_sync_started_at IS 'Timestamp de início da sincronização de histórico';
COMMENT ON COLUMN connections.history_sync_completed_at IS 'Timestamp de conclusão da sincronização de histórico';
COMMENT ON COLUMN connections.history_messages_synced IS 'Contador de mensagens sincronizadas do histórico';