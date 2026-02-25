-- ===================================
-- FASE 1: Correção completa de RLS Policies
-- Master vê tudo, Admin vê tudo do workspace, User vê apenas seus dados
-- ===================================

-- 1. WORKSPACE_MEMBERS - Permitir que usuários vejam suas próprias memberships
DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_manage" ON public.workspace_members;

CREATE POLICY "workspace_members_select_own" ON public.workspace_members
  FOR SELECT
  USING (
    user_id = current_system_user_id()
    OR is_current_user_master()
    OR is_current_user_admin()
  );

CREATE POLICY "workspace_members_manage_by_admin" ON public.workspace_members
  FOR ALL
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  )
  WITH CHECK (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- 2. CONVERSATIONS - Master vê tudo, Admin vê tudo do workspace, User vê atribuídas a ele OU não atribuídas
DROP POLICY IF EXISTS "conversations_select_by_workspace" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_by_workspace" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_by_workspace" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete_by_admin" ON public.conversations;

-- SELECT: Master vê tudo, Admin vê tudo do workspace, User vê suas ou não atribuídas
CREATE POLICY "conversations_select_by_role" ON public.conversations
  FOR SELECT
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
    OR (
      is_workspace_member(workspace_id, 'user'::system_profile)
      AND (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL)
    )
  );

-- INSERT: Qualquer membro pode criar conversas
CREATE POLICY "conversations_insert_by_workspace" ON public.conversations
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

-- UPDATE: Qualquer membro pode atualizar conversas
CREATE POLICY "conversations_update_by_workspace" ON public.conversations
  FOR UPDATE
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'user'::system_profile)
  );

-- DELETE: Apenas Admin/Master podem deletar
CREATE POLICY "conversations_delete_by_admin" ON public.conversations
  FOR DELETE
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- 3. PIPELINE_CARDS - Mesma lógica de hierarquia
DROP POLICY IF EXISTS "Users can view pipeline cards in their workspace" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Users can create pipeline cards in their workspace" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Users can update pipeline cards in their workspace" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Admins can delete pipeline cards in their workspace" ON public.pipeline_cards;

-- SELECT: Master vê tudo, Admin vê tudo do workspace, User vê seus cards ou não atribuídos
CREATE POLICY "pipeline_cards_select_by_role" ON public.pipeline_cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_cards.pipeline_id
      AND (
        is_current_user_master()
        OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
        OR (
          is_workspace_member(p.workspace_id, 'user'::system_profile)
          AND (
            pipeline_cards.responsible_user_id = current_system_user_id()
            OR pipeline_cards.responsible_user_id IS NULL
          )
        )
      )
    )
  );

-- INSERT: Qualquer membro pode criar cards
CREATE POLICY "pipeline_cards_insert_by_workspace" ON public.pipeline_cards
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_cards.pipeline_id
      AND is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  );

-- UPDATE: Qualquer membro pode atualizar cards (RLS vai filtrar o SELECT)
CREATE POLICY "pipeline_cards_update_by_workspace" ON public.pipeline_cards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_cards.pipeline_id
      AND is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  );

-- DELETE: Apenas Admin/Master podem deletar
CREATE POLICY "pipeline_cards_delete_by_admin" ON public.pipeline_cards
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_cards.pipeline_id
      AND (
        is_current_user_master()
        OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
      )
    )
  );

-- 4. MESSAGES - Master vê tudo, Admin vê tudo do workspace, User vê mensagens de suas conversas
DROP POLICY IF EXISTS "messages_select_by_workspace" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_service_and_members" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

-- SELECT: Hierarquia completa
CREATE POLICY "messages_select_by_role" ON public.messages
  FOR SELECT
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
    OR (
      is_workspace_member(workspace_id, 'user'::system_profile)
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id
        AND (c.assigned_user_id = current_system_user_id() OR c.assigned_user_id IS NULL)
      )
    )
  );

-- INSERT: Service role OU membros do workspace
CREATE POLICY "messages_insert_by_workspace" ON public.messages
  FOR INSERT
  WITH CHECK (
    ((auth.jwt() ->> 'role') = 'service_role')
    OR is_workspace_member(workspace_id, 'user'::system_profile)
  );

-- UPDATE: Apenas Admin/Master
CREATE POLICY "messages_update_by_admin" ON public.messages
  FOR UPDATE
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- DELETE: Apenas Admin/Master
CREATE POLICY "messages_delete_by_admin" ON public.messages
  FOR DELETE
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- 5. CONTACTS - Mesma lógica
DROP POLICY IF EXISTS "contacts_select_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_by_admin" ON public.contacts;

CREATE POLICY "contacts_select_by_workspace" ON public.contacts
  FOR SELECT
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_insert_by_workspace" ON public.contacts
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_update_by_workspace" ON public.contacts
  FOR UPDATE
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_delete_by_admin" ON public.contacts
  FOR DELETE
  USING (
    is_current_user_master()
    OR is_workspace_member(workspace_id, 'admin'::system_profile)
  );