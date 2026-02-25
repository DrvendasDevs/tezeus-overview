-- ===================================
-- CORREÇÃO: Permitir Realtime para todos os membros do workspace
-- ===================================
-- O problema: Políticas RLS muito restritivas bloqueiam eventos de realtime
-- Solução: Modificar a política existente para permitir que todos os membros 
-- do workspace recebam eventos UPDATE para garantir que mudanças de coluna 
-- sejam propagadas em tempo real. A filtragem visual continua sendo feita no frontend.

-- 1. Remover política restritiva atual
DROP POLICY IF EXISTS "pipeline_cards_select_by_role" ON public.pipeline_cards;

-- 2. Recriar política que permite todos os membros do workspace verem cards
-- Isso é necessário para o Supabase Realtime funcionar corretamente
-- A filtragem por responsabilidade continua sendo feita no frontend via getCardsByColumn
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
        -- User: membro do workspace pode ver cards (filtragem por responsabilidade no frontend)
        -- IMPORTANTE: Permitimos SELECT para todos os membros para garantir que eventos
        -- de realtime sejam recebidos. A filtragem visual é feita no frontend.
        (
          (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'user'
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
            AND wm.user_id = current_system_user_id()
          )
        )
      )
    )
  );

-- 3. Adicionar comentário explicativo
COMMENT ON POLICY "pipeline_cards_select_by_role" ON public.pipeline_cards IS 
'Permite que todos os membros do workspace vejam cards do pipeline para garantir que eventos de realtime sejam recebidos. A filtragem por responsabilidade (user vê apenas seus cards ou não atribuídos) é feita no frontend através da função getCardsByColumn.';

