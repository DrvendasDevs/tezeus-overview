-- Criar trigger para sincronização automática de responsible_user_id quando conversa é atribuída
CREATE OR REPLACE FUNCTION sync_pipeline_card_responsibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma conversa é atribuída ou reatribuída, atualizar cards relacionados
  IF OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id THEN
    UPDATE pipeline_cards 
    SET responsible_user_id = NEW.assigned_user_id,
        updated_at = NOW()
    WHERE conversation_id = NEW.id;
    
    RAISE NOTICE 'Pipeline cards synced for conversation % - responsible_user_id set to %', 
      NEW.id, NEW.assigned_user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa após update na tabela conversations
DROP TRIGGER IF EXISTS sync_pipeline_card_responsibility_trigger ON conversations;
CREATE TRIGGER sync_pipeline_card_responsibility_trigger
  AFTER UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION sync_pipeline_card_responsibility();