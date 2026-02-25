-- Corrigir funções de permissão de automação para usar system_profile (versão correta)
-- A função is_workspace_member usa system_profile com valores: 'user', 'admin', 'master'

-- Dropar funções antigas
DROP FUNCTION IF EXISTS check_column_permission(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS check_automation_permission(uuid, text) CASCADE;

-- Recriar função de verificação de permissão de coluna
CREATE OR REPLACE FUNCTION check_column_permission(
  p_column_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Buscar workspace_id da coluna
  SELECT pc.workspace_id INTO v_workspace_id
  FROM pipeline_columns pc
  WHERE pc.id = p_column_id;
  
  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se usuário tem acesso ao workspace
  -- Usar 'user' como role mínimo (a função is_workspace_member já verifica se é master)
  RETURN is_workspace_member(v_workspace_id, 'user'::system_profile);
END;
$$;

-- Recriar função de verificação de permissão de automação
CREATE OR REPLACE FUNCTION check_automation_permission(
  p_automation_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Buscar workspace_id da automação
  SELECT workspace_id INTO v_workspace_id
  FROM crm_column_automations
  WHERE id = p_automation_id;
  
  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se usuário tem acesso ao workspace
  -- Usar 'user' como role mínimo (a função is_workspace_member já verifica se é master)
  RETURN is_workspace_member(v_workspace_id, 'user'::system_profile);
END;
$$;