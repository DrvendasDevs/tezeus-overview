-- Adicionar foreign key constraint entre system_users e cargos
ALTER TABLE public.system_users 
ADD CONSTRAINT fk_system_users_cargo_id 
FOREIGN KEY (cargo_id) REFERENCES public.cargos(id) ON DELETE SET NULL;

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_system_users_cargo_id ON public.system_users(cargo_id);
CREATE INDEX IF NOT EXISTS idx_system_users_email ON public.system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_status ON public.system_users(status);
CREATE INDEX IF NOT EXISTS idx_cargos_nome ON public.cargos(nome);

-- Adicionar triggers para updated_at nas tabelas se não existirem
DO $$
BEGIN
    -- Trigger para system_users
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_system_users_updated_at'
    ) THEN
        CREATE TRIGGER update_system_users_updated_at
            BEFORE UPDATE ON public.system_users
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;

    -- Trigger para cargos
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_cargos_updated_at'
    ) THEN
        CREATE TRIGGER update_cargos_updated_at
            BEFORE UPDATE ON public.cargos
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Adicionar constraints de validação
ALTER TABLE public.system_users 
ADD CONSTRAINT check_status_valid 
CHECK (status IN ('active', 'inactive', 'suspended'));

ALTER TABLE public.system_users 
ADD CONSTRAINT check_profile_valid 
CHECK (profile IN ('admin', 'user', 'supervisor', 'operator'));

ALTER TABLE public.system_users 
ADD CONSTRAINT check_email_format 
CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Garantir que nome não seja vazio
ALTER TABLE public.system_users 
ADD CONSTRAINT check_name_not_empty 
CHECK (length(trim(name)) > 0);

ALTER TABLE public.cargos 
ADD CONSTRAINT check_nome_not_empty 
CHECK (length(trim(nome)) > 0);

ALTER TABLE public.cargos 
ADD CONSTRAINT check_tipo_not_empty 
CHECK (length(trim(tipo)) > 0);

ALTER TABLE public.cargos 
ADD CONSTRAINT check_funcao_not_empty 
CHECK (length(trim(funcao)) > 0);

-- Adicionar constraint de unicidade para email (se não for nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_users_email_unique 
ON public.system_users(email) 
WHERE email IS NOT NULL;