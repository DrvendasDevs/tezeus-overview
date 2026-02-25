-- ===================================
-- CORREÇÃO CRÍTICA: Simplificar RLS para garantir que Admin/Master vejam TUDO
-- ===================================

-- 1. PIPELINE_CARDS - Recriar política com lógica mais simples e direta
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
        -- User: vê apenas seus cards OU não atribuídos
        (
          (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'user'
          AND EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
            AND wm.user_id = current_system_user_id()
          )
          AND (
            pipeline_cards.responsible_user_id = current_system_user_id()
            OR pipeline_cards.responsible_user_id IS NULL
          )
        )
      )
    )
  );

-- 2. CONVERSATIONS - Recriar política com lógica mais simples
DROP POLICY IF EXISTS "conversations_select_by_role" ON public.conversations;

CREATE POLICY "conversations_select_by_role" ON public.conversations
  FOR SELECT
  USING (
    -- Master global: vê TUDO
    (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'master'
    OR
    -- Admin do workspace: vê TUDO do workspace
    (
      (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'admin'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = conversations.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
    OR
    -- User: vê apenas suas conversas OU não atribuídas
    (
      (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'user'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = conversations.workspace_id
        AND wm.user_id = current_system_user_id()
      )
      AND (
        conversations.assigned_user_id = current_system_user_id()
        OR conversations.assigned_user_id IS NULL
      )
    )
  );

-- 3. MESSAGES - Recriar política com lógica mais simples
DROP POLICY IF EXISTS "messages_select_by_role" ON public.messages;

CREATE POLICY "messages_select_by_role" ON public.messages
  FOR SELECT
  USING (
    -- Master global: vê TUDO
    (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'master'
    OR
    -- Admin do workspace: vê TUDO do workspace
    (
      (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'admin'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = messages.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
    OR
    -- User: vê apenas mensagens de suas conversas OU conversas não atribuídas
    (
      (SELECT profile FROM system_users WHERE id = current_system_user_id()) = 'user'
      AND EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = messages.workspace_id
        AND wm.user_id = current_system_user_id()
      )
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND (
          c.assigned_user_id = current_system_user_id()
          OR c.assigned_user_id IS NULL
        )
      )
    )
  );