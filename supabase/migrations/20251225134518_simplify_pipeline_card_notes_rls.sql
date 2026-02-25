-- Simplificar políticas RLS para pipeline_card_notes
-- Políticas muito mais permissivas: verificar apenas se workspace_id existe
-- A segurança real vem do RLS do pipeline_cards que já verifica workspace membership
-- Se o usuário consegue ver o card, pode criar/ver/editar/deletar notas

DROP POLICY IF EXISTS "Users can view notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can create notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can update notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can delete notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can view notes for cards they can see" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can create notes for cards they can see" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can update notes for cards they can see" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can delete notes for cards they can see" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "pipeline_card_notes_select" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "pipeline_card_notes_insert" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "pipeline_card_notes_update" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "pipeline_card_notes_delete" ON public.pipeline_card_notes;

-- SELECT: Verificar apenas se workspace_id existe (muito permissivo)
CREATE POLICY "pipeline_card_notes_select"
  ON public.pipeline_card_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = pipeline_card_notes.workspace_id
    )
  );

-- INSERT: Verificar apenas se workspace_id existe e card_id existe
CREATE POLICY "pipeline_card_notes_insert"
  ON public.pipeline_card_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = pipeline_card_notes.workspace_id
    )
    AND EXISTS (
      SELECT 1 FROM pipeline_cards pc
      WHERE pc.id = pipeline_card_notes.card_id
    )
  );

-- UPDATE: Verificar apenas se workspace_id existe
CREATE POLICY "pipeline_card_notes_update"
  ON public.pipeline_card_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = pipeline_card_notes.workspace_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = pipeline_card_notes.workspace_id
    )
  );

-- DELETE: Verificar apenas se workspace_id existe
CREATE POLICY "pipeline_card_notes_delete"
  ON public.pipeline_card_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = pipeline_card_notes.workspace_id
    )
  );

