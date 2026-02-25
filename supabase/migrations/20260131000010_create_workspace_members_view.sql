-- =============================================
-- Migração: Criar VIEW workspace_members_view com nome do usuário
-- =============================================
-- Esta VIEW faz JOIN com system_users para incluir informações do usuário

-- Criar VIEW que inclui dados do usuário
CREATE OR REPLACE VIEW public.workspace_members_view AS
SELECT 
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.is_hidden,
  wm.created_at,
  su.name as user_name,
  su.email as user_email,
  su.profile as user_profile,
  su.status as user_status,
  su.avatar as user_avatar,
  w.name as workspace_name
FROM public.workspace_members wm
INNER JOIN public.system_users su ON su.id = wm.user_id
LEFT JOIN public.workspaces w ON w.id = wm.workspace_id;

-- Conceder permissões
GRANT SELECT ON public.workspace_members_view TO authenticated;
GRANT SELECT ON public.workspace_members_view TO anon;

COMMENT ON VIEW public.workspace_members_view IS 'VIEW de workspace_members com informações do usuário (nome, email, perfil, status, avatar) e nome do workspace';
