-- ===================================
-- CORREÇÃO: Adicionar suporte a view_all_deals_permissions na política RLS
-- ===================================

-- Atualizar política para incluir verificação de permissões de coluna
DROP POLICY IF EXISTS "pipeline_cards_select_by_role" ON public.pipeline_cards;

CREATE POLICY "pipeline_cards_select_by_role" ON public.pipeline_cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_cards.pipeline_id
      AND (
        -- Master global: vê TUDO
        (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'master'
        OR
        -- Admin do workspace: vê TUDO do workspace
        (
          (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'admin'
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
            AND wm.user_id = current_system_user_id()
          )
        )
        OR
        -- User: vê seus cards OU não atribuídos OU cards em colunas onde tem permissão
        (
          (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'user'
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
            AND wm.user_id = current_system_user_id()
          )
          AND (
            -- Card atribuído ao usuário
            pipeline_cards.responsible_user_id = current_system_user_id()
            OR
            -- Card não atribuído
            pipeline_cards.responsible_user_id IS NULL
            OR
            -- Usuário tem permissão para ver todos os negócios desta coluna
            EXISTS (
              SELECT 1 FROM pipeline_columns pc
              WHERE pc.id = pipeline_cards.column_id
              AND (
                pc.view_all_deals_permissions @> jsonb_build_array(current_system_user_id()::text)
                OR pc.view_all_deals_permissions @> jsonb_build_array(current_system_user_id())
              )
            )
          )
        )
      )
    )
  );


