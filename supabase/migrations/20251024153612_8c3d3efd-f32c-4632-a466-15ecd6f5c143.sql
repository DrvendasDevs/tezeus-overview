-- Adicionar coluna default_column_id na tabela connections
ALTER TABLE connections 
ADD COLUMN IF NOT EXISTS default_column_id uuid REFERENCES pipeline_columns(id);