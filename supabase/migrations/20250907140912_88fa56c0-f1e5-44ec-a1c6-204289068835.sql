-- Primeiro, vamos criar o novo enum para workspace roles alinhado com system_users profiles
CREATE TYPE IF NOT EXISTS public.system_profile AS ENUM ('master', 'admin', 'user');

-- Adicionar nova coluna temporária na tabela workspace_members
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS new_role public.system_profile;

-- Migrar dados existentes para o novo formato
UPDATE public.workspace_members 
SET new_role = CASE 
  WHEN role = 'mentor_master' THEN 'master'::system_profile
  WHEN role = 'gestor' THEN 'admin'::system_profile  
  WHEN role = 'colaborador' THEN 'user'::system_profile
  ELSE 'user'::system_profile
END;

-- Remover a coluna antiga e renomear a nova
ALTER TABLE public.workspace_members DROP COLUMN role;
ALTER TABLE public.workspace_members RENAME COLUMN new_role TO role;

-- Definir NOT NULL e default
ALTER TABLE public.workspace_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.workspace_members ALTER COLUMN role SET DEFAULT 'user'::system_profile;

-- Atualizar função is_workspace_member para usar os novos roles
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role system_profile DEFAULT 'user'::system_profile)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_user uuid;
  cur_role public.system_profile;
BEGIN
  -- Se não há JWT/email, negar
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Master global (via perfil)
  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Papel do usuário no workspace
  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Hierarquia: master > admin > user
  IF p_min_role = 'user' THEN
    RETURN TRUE; -- qualquer papel listado atende
  ELSIF p_min_role = 'admin' THEN
    RETURN cur_role IN ('admin','master');
  ELSIF p_min_role = 'master' THEN
    RETURN cur_role = 'master';
  END IF;

  RETURN FALSE;
END;
$function$;

-- Remover o enum antigo
DROP TYPE IF EXISTS public.workspace_role;