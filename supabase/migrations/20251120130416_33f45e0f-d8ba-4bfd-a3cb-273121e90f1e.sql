-- Migração para popular pipeline_card_history com eventos de tags existentes
-- Isso garante que tags atuais tenham seu histórico de criação registrado

DO $$
DECLARE
  v_contact_tag RECORD;
  v_pipeline_data RECORD;
  v_tag_data RECORD;
  v_user_name TEXT;
  v_inserted_count INTEGER := 0;
BEGIN
  -- Para cada contact_tag existente, criar um evento de tag_added se ainda não existe
  FOR v_contact_tag IN 
    SELECT DISTINCT ct.id, ct.contact_id, ct.tag_id, ct.created_at, ct.created_by
    FROM contact_tags ct
  LOOP
    -- Buscar o pipeline_card relacionado a esse contato
    SELECT pc.id as card_id, p.workspace_id, pc.pipeline_id
    INTO v_pipeline_data
    FROM pipeline_cards pc
    JOIN pipelines p ON p.id = pc.pipeline_id
    WHERE pc.contact_id = v_contact_tag.contact_id
    AND pc.status = 'aberto'
    LIMIT 1;

    -- Se encontrou um card aberto para este contato
    IF FOUND THEN
      -- Buscar informações da tag
      SELECT name, color INTO v_tag_data
      FROM tags
      WHERE id = v_contact_tag.tag_id;

      -- Buscar nome do usuário que criou
      v_user_name := NULL;
      IF v_contact_tag.created_by IS NOT NULL THEN
        SELECT name INTO v_user_name
        FROM system_users
        WHERE id = v_contact_tag.created_by;
      END IF;

      -- Verificar se já existe um evento para esta tag neste card
      IF NOT EXISTS (
        SELECT 1 FROM pipeline_card_history
        WHERE card_id = v_pipeline_data.card_id
        AND action = 'tag_added'
        AND (metadata->>'tag_id')::uuid = v_contact_tag.tag_id
      ) THEN
        -- Inserir evento de tag_added no histórico
        INSERT INTO pipeline_card_history (
          card_id,
          action,
          workspace_id,
          metadata,
          changed_at
        ) VALUES (
          v_pipeline_data.card_id,
          'tag_added',
          v_pipeline_data.workspace_id,
          jsonb_build_object(
            'tag_id', v_contact_tag.tag_id,
            'tag_name', v_tag_data.name,
            'tag_color', v_tag_data.color,
            'added_at', v_contact_tag.created_at,
            'added_by', v_contact_tag.created_by,
            'changed_by_name', v_user_name
          ),
          v_contact_tag.created_at
        );

        v_inserted_count := v_inserted_count + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total de % eventos de tag_added criados no histórico', v_inserted_count;
END $$;