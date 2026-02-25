-- Criar o novo enum para workspace roles alinhado com system_users profiles
CREATE TYPE public.system_profile AS ENUM ('master', 'admin', 'user');

-- Migrar a coluna role de workspace_members para usar o novo enum
-- Adicionar nova coluna temporária
ALTER TABLE public.workspace_members ADD COLUMN new_role public.system_profile;

-- Migrar dados existentes para o novo formato
UPDATE public.workspace_members 
SET new_role = CASE 
  WHEN role = 'mentor_master' THEN 'master'::system_profile
  WHEN role = 'gestor' THEN 'admin'::system_profile  
  WHEN role = 'colaborador' THEN 'user'::system_profile
  ELSE 'user'::system_profile
END;

-- Remover a coluna antiga e renomear a nova
ALTER TABLE public.workspace_members DROP COLUMN role CASCADE;
ALTER TABLE public.workspace_members RENAME COLUMN new_role TO role;

-- Definir NOT NULL e default
ALTER TABLE public.workspace_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.workspace_members ALTER COLUMN role SET DEFAULT 'user'::system_profile;