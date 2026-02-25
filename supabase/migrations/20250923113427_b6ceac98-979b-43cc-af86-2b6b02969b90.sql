-- Habilitar RLS nas tabelas que estão faltando
ALTER TABLE pipeline_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

-- Verificar se as políticas estão funcionando agora
-- Testando permissões de exemplo
SELECT 
  current_system_user_id() as user_id,
  is_current_user_master() as is_master,
  is_workspace_member('9379d213-8df0-47a8-a1b0-9d71e036fa5d'::uuid, 'admin'::system_profile) as is_workspace_admin;