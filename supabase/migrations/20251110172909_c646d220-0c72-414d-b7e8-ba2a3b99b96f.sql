-- Corrigir função log_pipeline_card_changes que estava com erro
DROP FUNCTION IF EXISTS log_pipeline_card_changes() CASCADE;

CREATE OR REPLACE FUNCTION log_pipeline_card_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_workspace_id uuid;
  v_old_column_name text;
  v_new_column_name text;
BEGIN
  -- Buscar workspace_id do pipeline via coluna (NEW.column_id)
  BEGIN
    SELECT p.workspace_id INTO v_workspace_id
    FROM pipeline_columns pc
    JOIN pipelines p ON p.id = pc.pipeline_id
    WHERE pc.id = NEW.column_id
    LIMIT 1;
    
    IF v_workspace_id IS NULL THEN
      RAISE NOTICE 'workspace_id não encontrado para column_id %', NEW.column_id;
      RETURN NEW;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao buscar workspace_id: %', SQLERRM;
      RETURN NEW;
  END;

  -- Log de mudança de coluna
  IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
    -- Buscar nomes das colunas
    SELECT name INTO v_old_column_name FROM pipeline_columns WHERE id = OLD.column_id;
    SELECT name INTO v_new_column_name FROM pipeline_columns WHERE id = NEW.column_id;
    
    INSERT INTO pipeline_card_history (card_id, action, changed_by, workspace_id, metadata)
    VALUES (NEW.id, 'column_changed', auth.uid(), v_workspace_id,
      jsonb_build_object(
        'old_column_id', OLD.column_id, 
        'old_column_name', v_old_column_name,
        'new_column_id', NEW.column_id, 
        'new_column_name', v_new_column_name
      ));
  END IF;

  -- Log de mudança de responsável
  IF OLD.responsible_user_id IS DISTINCT FROM NEW.responsible_user_id THEN
    INSERT INTO pipeline_card_history (card_id, action, changed_by, workspace_id, metadata)
    VALUES (NEW.id, 'card_assigned', auth.uid(), v_workspace_id,
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
    VALUES (NEW.id, 'status_changed', auth.uid(), v_workspace_id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      ));
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro no trigger log_pipeline_card_changes: %', SQLERRM;
    RETURN NEW; -- Não falhar o update se o log falhar
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
CREATE TRIGGER trigger_log_pipeline_card_changes
  AFTER UPDATE ON pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_pipeline_card_changes();