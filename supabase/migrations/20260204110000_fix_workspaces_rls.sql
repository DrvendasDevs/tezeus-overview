-- ============================================================================
-- Migration: Corrigir políticas RLS de workspaces
-- Descrição: Garante que masters possam acessar todos os workspaces
-- ============================================================================

-- Dropar todas as políticas existentes de workspaces para evitar conflitos
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_by_role" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_select_members" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_master_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_by_role" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_by_role" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_by_role" ON public.workspaces;

-- Garantir que RLS está habilitado
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- SELECT: Masters veem todos, membros veem seus workspaces
CREATE POLICY "workspaces_select_policy"
ON public.workspaces
FOR SELECT
USING (
  -- Master pode ver todos
  is_current_user_master() 
  OR 
  -- Admin global pode ver todos
  is_current_user_admin()
  OR 
  -- Membros podem ver seus workspaces
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
    AND wm.user_id = current_system_user_id()
  )
);

-- INSERT: Apenas masters podem criar workspaces
CREATE POLICY "workspaces_insert_policy"
ON public.workspaces
FOR INSERT
WITH CHECK (
  is_current_user_master()
);

-- UPDATE: Masters podem atualizar todos, admins podem atualizar seus workspaces
CREATE POLICY "workspaces_update_policy"
ON public.workspaces
FOR UPDATE
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
);

-- DELETE: Apenas masters podem deletar workspaces
CREATE POLICY "workspaces_delete_policy"
ON public.workspaces
FOR DELETE
USING (is_current_user_master());

-- Verificar se as funções auxiliares existem
DO $$
BEGIN
  -- Verificar is_current_user_master
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_current_user_master') THEN
    RAISE WARNING 'Função is_current_user_master não existe - criando...';
    
    CREATE OR REPLACE FUNCTION public.is_current_user_master()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 
        FROM public.system_users 
        WHERE id = auth.uid() 
        AND profile = 'master'
      );
    $func$;
  END IF;
  
  -- Verificar is_current_user_admin
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_current_user_admin') THEN
    RAISE WARNING 'Função is_current_user_admin não existe - criando...';
    
    CREATE OR REPLACE FUNCTION public.is_current_user_admin()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT EXISTS (
        SELECT 1 
        FROM public.system_users 
        WHERE id = auth.uid() 
        AND profile IN ('master', 'admin')
      );
    $func$;
  END IF;
  
  -- Verificar current_system_user_id
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_system_user_id') THEN
    RAISE WARNING 'Função current_system_user_id não existe - criando...';
    
    CREATE OR REPLACE FUNCTION public.current_system_user_id()
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $func$
      SELECT auth.uid();
    $func$;
  END IF;
  RAISE NOTICE '✅ Políticas RLS de workspaces atualizadas com sucesso';
END $$;
