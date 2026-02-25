-- Criar função que registra ações de tags no histórico do pipeline
CREATE OR REPLACE FUNCTION log_contact_tag_action()
RETURNS TRIGGER AS $$
DECLARE
  v_card RECORD;
  v_tag RECORD;
  v_user_name TEXT;
  v_action TEXT;
BEGIN
  -- Determinar a ação (inserção ou remoção)
  IF TG_OP = 'INSERT' THEN
    v_action := 'tag_added';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'tag_removed';
  ELSE
    RETURN NULL;
  END IF;

  -- Buscar o card aberto relacionado a este contato
  SELECT pc.id as card_id, p.workspace_id, pc.pipeline_id
  INTO v_card
  FROM pipeline_cards pc
  JOIN pipelines p ON p.id = pc.pipeline_id
  WHERE pc.contact_id = COALESCE(NEW.contact_id, OLD.contact_id)
  AND pc.status = 'aberto'
  LIMIT 1;

  -- Se não encontrou card aberto, não registrar
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Buscar informações da tag
  SELECT name, color INTO v_tag
  FROM tags
  WHERE id = COALESCE(NEW.tag_id, OLD.tag_id);

  -- Buscar nome do usuário que fez a ação
  v_user_name := NULL;
  IF COALESCE(NEW.created_by, OLD.created_by) IS NOT NULL THEN
    SELECT name INTO v_user_name
    FROM system_users
    WHERE id = COALESCE(NEW.created_by, OLD.created_by);
  END IF;

  -- Inserir no histórico do card
  INSERT INTO pipeline_card_history (
    card_id,
    action,
    workspace_id,
    changed_by,
    metadata,
    changed_at
  ) VALUES (
    v_card.card_id,
    v_action,
    v_card.workspace_id,
    COALESCE(NEW.created_by, OLD.created_by),
    jsonb_build_object(
      'tag_id', COALESCE(NEW.tag_id, OLD.tag_id),
      'tag_name', v_tag.name,
      'tag_color', v_tag.color,
      'changed_by_name', v_user_name,
      'contact_id', COALESCE(NEW.contact_id, OLD.contact_id)
    ),
    COALESCE(NEW.created_at, OLD.created_at, NOW())
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS contact_tag_action_logger ON contact_tags;

-- Criar trigger para INSERT e DELETE em contact_tags
CREATE TRIGGER contact_tag_action_logger
AFTER INSERT OR DELETE ON contact_tags
FOR EACH ROW
EXECUTE FUNCTION log_contact_tag_action();