-- =============================================
-- Migração: Adicionar perfil 'support' (Sucesso do Cliente)
-- =============================================
-- O perfil 'support' é um nível de acesso para equipe de Sucesso do Cliente
-- que tem acesso a todas as empresas (como master), mas com algumas restrições:
-- - Na Central Tezeus: só acessa Empresas, Agentes IA, Filas, Laboratório e Auditoria
-- - Só pode criar usuários admin e user (não pode criar master nem support)
-- - Não pode apagar o próprio usuário
-- - É um usuário oculto (não aparece em listagens de workspace)
-- - Pertence automaticamente a todos os workspaces

-- 1. Adicionar 'support' ao enum system_profile
DO $$
BEGIN
  -- Verificar se o valor já existe no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'support' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'system_profile')
  ) THEN
    ALTER TYPE system_profile ADD VALUE 'support';
  END IF;
END $$;

-- 1.1 Atualizar a constraint check_profile_valid para incluir 'support'
ALTER TABLE public.system_users 
DROP CONSTRAINT IF EXISTS check_profile_valid;

ALTER TABLE public.system_users 
ADD CONSTRAINT check_profile_valid 
CHECK (profile IN ('admin', 'user', 'manager', 'master', 'support'));

-- 2. Atualizar a função is_workspace_member para tratar 'support' como 'master'
-- Primeiro, dropar a versão existente com 2 parâmetros (se existir)
DO $$
BEGIN
  -- Tentar dropar a função com a assinatura específica
  DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, uuid);
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    -- Se houver dependências, apenas ignorar (a função será atualizada abaixo)
    NULL;
END $$;

-- Criar ou substituir a função
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  -- Obter o perfil do usuário
  SELECT profile INTO v_profile
  FROM public.system_users
  WHERE id = p_user_id;

  -- Se for master ou support, tem acesso a todos os workspaces
  IF v_profile IN ('master', 'support') THEN
    RETURN TRUE;
  END IF;

  -- Para outros perfis, verificar membership
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
  );
END;
$$;

-- 3. Atualizar a função is_current_user_master para incluir support (para bypass de RLS em algumas situações)
-- Nota: Não usar DROP pois há muitas políticas RLS que dependem desta função
CREATE OR REPLACE FUNCTION public.is_current_user_master()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  SELECT profile INTO v_profile
  FROM public.system_users
  WHERE id = auth.uid();

  RETURN v_profile IN ('master', 'support');
END;
$$;

-- 4. Criar função auxiliar para verificar se é support
CREATE OR REPLACE FUNCTION public.is_current_user_support()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  SELECT profile INTO v_profile
  FROM public.system_users
  WHERE id = auth.uid();

  RETURN v_profile = 'support';
END;
$$;

-- 5. Criar função auxiliar para verificar se é master puro (não support)
CREATE OR REPLACE FUNCTION public.is_current_user_master_only()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
BEGIN
  SELECT profile INTO v_profile
  FROM public.system_users
  WHERE id = auth.uid();

  RETURN v_profile = 'master';
END;
$$;

-- Comentários (especificando assinatura para evitar ambiguidade)
COMMENT ON FUNCTION public.is_workspace_member(uuid, uuid) IS 'Verifica se o usuário é membro de um workspace. Master e Support têm acesso a todos os workspaces.';
COMMENT ON FUNCTION public.is_current_user_master() IS 'Verifica se o usuário atual é master ou support (acesso elevado).';
COMMENT ON FUNCTION public.is_current_user_support() IS 'Verifica se o usuário atual é support (Sucesso do Cliente).';
COMMENT ON FUNCTION public.is_current_user_master_only() IS 'Verifica se o usuário atual é master puro (não support).';
