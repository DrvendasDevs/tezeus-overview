-- Remover trigger problemático que referencia campo inexistente
DROP TRIGGER IF EXISTS trigger_log_pipeline_card_changes ON pipeline_cards;
DROP FUNCTION IF EXISTS log_pipeline_card_agent_change();

-- Criar nova função de log sem referências a ai_agent_enabled
CREATE OR REPLACE FUNCTION log_pipeline_card_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log de mudança de coluna
  IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    INSERT INTO pipeline_card_history (card_id, action, changed_by, workspace_id, metadata)
    VALUES (NEW.id, 'column_changed', auth.uid(), NEW.workspace_id,
      jsonb_build_object(
        'old_column_id', OLD.column_id, 
        'old_column_name', (SELECT name FROM pipeline_columns WHERE id = OLD.column_id),
        'new_column_id', NEW.column_id, 
        'new_column_name', (SELECT name FROM pipeline_columns WHERE id = NEW.column_id)
      ));
  END IF;

  -- Log de mudança de responsável
  IF OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id THEN
    INSERT INTO pipeline_card_history (card_id, action, changed_by, workspace_id, metadata)
    VALUES (NEW.id, 'card_assigned', auth.uid(), NEW.workspace_id,
      jsonb_build_object(
        'old_responsible_id', OLD.responsible_user_id, 
        'old_responsible_name', (SELECT name FROM system_users WHERE id = OLD.responsible_user_id),
        'new_responsible_id', NEW.responsible_user_id, 
        'new_responsible_name', (SELECT name FROM system_users WHERE id = NEW.responsible_user_id)
      ));
  END IF;

  -- Log de mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO pipeline_card_history (card_id, action, changed_by, workspace_id, metadata)
    VALUES (NEW.id, 'status_changed', auth.uid(), NEW.workspace_id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      ));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger corrigido
CREATE TRIGGER trigger_log_pipeline_card_changes
AFTER UPDATE ON pipeline_cards
FOR EACH ROW
EXECUTE FUNCTION log_pipeline_card_changes();