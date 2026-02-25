-- Adicionar coluna senha na tabela system_users
ALTER TABLE public.system_users 
ADD COLUMN senha text;

-- Adicionar constraint para senha não ser vazia (quando não for nula)
ALTER TABLE public.system_users 
ADD CONSTRAINT check_senha_not_empty 
CHECK (senha IS NULL OR length(trim(senha)) > 0);