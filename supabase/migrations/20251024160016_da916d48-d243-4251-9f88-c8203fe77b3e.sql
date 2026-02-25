-- Adicionar coluna default_column_name na tabela connections
ALTER TABLE connections
ADD COLUMN IF NOT EXISTS default_column_name TEXT;

COMMENT ON COLUMN connections.default_column_name IS 'Nome da coluna padrão onde os cards serão criados automaticamente';