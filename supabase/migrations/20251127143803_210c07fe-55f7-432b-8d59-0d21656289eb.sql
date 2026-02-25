-- Add icon field to pipeline_columns table
ALTER TABLE pipeline_columns 
ADD COLUMN icon TEXT DEFAULT 'Circle';

-- Add comment to explain the column
COMMENT ON COLUMN pipeline_columns.icon IS 'Lucide icon name to display in timeline view';