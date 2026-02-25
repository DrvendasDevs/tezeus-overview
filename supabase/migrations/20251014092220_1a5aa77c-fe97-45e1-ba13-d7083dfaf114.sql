-- Add history_days column to connections table to store the history recovery period
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS history_days INTEGER DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN connections.history_days IS 'Number of days to sync from history (0 = none, 1 = last day, 7 = week, 30 = month, -1 = full)';