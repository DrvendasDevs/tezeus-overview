-- Criar tabela para anotações do card
CREATE TABLE IF NOT EXISTS public.pipeline_card_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES public.system_users(id),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pipeline_card_notes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (simplificadas com workspace_id direto)
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

-- Trigger para updated_at
CREATE TRIGGER update_pipeline_card_notes_updated_at
BEFORE UPDATE ON public.pipeline_card_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar função que registra anotações no histórico do pipeline
CREATE OR REPLACE FUNCTION log_pipeline_card_note_action()
RETURNS TRIGGER AS $$
DECLARE
  v_card RECORD;
  v_user_name TEXT;
BEGIN
  -- Buscar informações do card e workspace
  SELECT pc.id as card_id, p.workspace_id, pc.pipeline_id
  INTO v_card
  FROM pipeline_cards pc
  JOIN pipelines p ON p.id = pc.pipeline_id
  WHERE pc.id = NEW.card_id
  LIMIT 1;

  -- Se não encontrou card, não registrar
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Buscar nome do usuário que criou a anotação
  v_user_name := NULL;
  IF NEW.created_by IS NOT NULL THEN
    SELECT name INTO v_user_name
    FROM system_users
    WHERE id = NEW.created_by;
  END IF;

  -- Inserir no histórico do card
  -- Usar NULL no changed_by (foreign key pode apontar para auth.users que não é usado)
  -- Armazenar o ID do system_users no metadata
  INSERT INTO pipeline_card_history (
    card_id,
    action,
    workspace_id,
    changed_by,
    metadata,
    changed_at
  ) VALUES (
    v_card.card_id,
    'note_created',
    v_card.workspace_id,
    NULL, -- NULL para evitar erro de foreign key (sistema não usa auth.users)
    jsonb_build_object(
      'note_id', NEW.id,
      'content', NEW.content,
      'description', 'Anotação adicionada: ' || LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      'changed_by_name', v_user_name,
      'created_by', NEW.created_by -- ID do system_users armazenado no metadata
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para INSERT em pipeline_card_notes
CREATE TRIGGER pipeline_card_note_action_logger
AFTER INSERT ON pipeline_card_notes
FOR EACH ROW
EXECUTE FUNCTION log_pipeline_card_note_action();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pipeline_card_notes_card_id ON public.pipeline_card_notes(card_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_card_notes_created_at ON public.pipeline_card_notes(created_at DESC);

