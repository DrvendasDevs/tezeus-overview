-- Passo 1: Limpar contatos duplicados com sufixo 62
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    WITH duplicated_phones AS (
      SELECT 
        id,
        phone,
        workspace_id,
        CASE 
          WHEN phone ~ '62$' AND length(phone) > 13 THEN substring(phone, 1, length(phone)-2)
          ELSE phone
        END as normalized_phone
      FROM contacts
      WHERE phone ~ '62$' AND length(phone) > 13
    )
    SELECT 
      dp.id as duplicate_contact_id,
      c.id as correct_contact_id
    FROM duplicated_phones dp
    JOIN contacts c ON c.phone = dp.normalized_phone AND c.workspace_id = dp.workspace_id
  LOOP
    -- Atualizar referências
    UPDATE conversations SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    UPDATE activities SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    UPDATE contact_observations SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    UPDATE pipeline_cards SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    
    -- Evitar duplicação de tags
    DELETE FROM contact_tags 
    WHERE contact_id = dup_record.duplicate_contact_id
    AND tag_id IN (SELECT tag_id FROM contact_tags WHERE contact_id = dup_record.correct_contact_id);
    
    UPDATE contact_tags SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    
    -- Evitar duplicação de extra_info
    DELETE FROM contact_extra_info 
    WHERE contact_id = dup_record.duplicate_contact_id
    AND field_name IN (SELECT field_name FROM contact_extra_info WHERE contact_id = dup_record.correct_contact_id);
    
    UPDATE contact_extra_info SET contact_id = dup_record.correct_contact_id WHERE contact_id = dup_record.duplicate_contact_id;
    
    -- Deletar contato duplicado
    DELETE FROM contacts WHERE id = dup_record.duplicate_contact_id;
  END LOOP;
END $$;

-- Passo 2: Remover conversas duplicadas (manter a mais recente)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY contact_id, connection_id, workspace_id ORDER BY created_at DESC) as rn
  FROM conversations
  WHERE status != 'closed'
)
DELETE FROM conversations
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Passo 3: Adicionar índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_workspace 
ON contacts(phone, workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_contact_connection_open
ON conversations(contact_id, connection_id, workspace_id) 
WHERE status != 'closed';