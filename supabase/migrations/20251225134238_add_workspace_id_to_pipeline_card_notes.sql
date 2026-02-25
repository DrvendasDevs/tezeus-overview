-- Adicionar coluna workspace_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_card_notes' 
    AND column_name = 'workspace_id'
  ) THEN
    -- Adicionar coluna workspace_id
    ALTER TABLE public.pipeline_card_notes 
    ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    
    -- Preencher workspace_id com base no card_id
    UPDATE public.pipeline_card_notes pcn
    SET workspace_id = (
      SELECT p.workspace_id
      FROM pipeline_cards pc
      JOIN pipelines p ON p.id = pc.pipeline_id
      WHERE pc.id = pcn.card_id
      LIMIT 1
    );
    
    -- Tornar a coluna NOT NULL após preencher
    ALTER TABLE public.pipeline_card_notes 
    ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END $$;

-- Recriar políticas RLS com workspace_id direto
DROP POLICY IF EXISTS "Users can view notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can create notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can update notes in their workspace" ON public.pipeline_card_notes;
DROP POLICY IF EXISTS "Users can delete notes in their workspace" ON public.pipeline_card_notes;

CREATE POLICY "Users can view notes in their workspace"
  ON public.pipeline_card_notes FOR SELECT
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can create notes in their workspace"
  ON public.pipeline_card_notes FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can update notes in their workspace"
  ON public.pipeline_card_notes FOR UPDATE
  USING (is_workspace_member(workspace_id, 'user'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can delete notes in their workspace"
  ON public.pipeline_card_notes FOR DELETE
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

