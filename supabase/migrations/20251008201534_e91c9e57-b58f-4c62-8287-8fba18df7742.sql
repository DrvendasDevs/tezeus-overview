-- Remove unique constraint que impede múltiplos cards por contato no pipeline
DROP INDEX IF EXISTS idx_unique_contact_pipeline_open;