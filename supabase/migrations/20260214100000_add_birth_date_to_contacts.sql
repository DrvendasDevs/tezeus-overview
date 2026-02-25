-- Adicionar coluna birth_date na tabela contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birth_date date NULL;

-- Índice para busca eficiente de aniversariantes (mês + dia)
CREATE INDEX IF NOT EXISTS idx_contacts_birth_date ON contacts (birth_date);
