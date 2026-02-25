-- Executar sincronização manual de cards existentes
UPDATE pipeline_cards 
SET responsible_user_id = c.assigned_user_id,
    updated_at = NOW()
FROM conversations c
WHERE pipeline_cards.conversation_id = c.id
  AND pipeline_cards.responsible_user_id IS DISTINCT FROM c.assigned_user_id;

-- Corrigir políticas RLS para pipeline_cards - remover política que permite ver cards NULL
DROP POLICY IF EXISTS "Users can view pipeline cards based on responsibility" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can create/update pipeline cards based on responsibility" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can update pipeline cards based on responsibility" ON pipeline_cards;

-- Criar nova política mais restritiva para usuários comuns
CREATE POLICY "Users can view pipeline cards based on responsibility_v2" 
ON pipeline_cards 
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
        AND pipeline_cards.responsible_user_id = current_system_user_id()
      )
    )
  )
);

-- Política para criação/inserção
CREATE POLICY "Users can create pipeline cards based on responsibility_v2" 
ON pipeline_cards 
FOR INSERT 
WITH CHECK (
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

-- Política para atualização
CREATE POLICY "Users can update pipeline cards based on responsibility_v2" 
ON pipeline_cards 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
      OR (
        is_workspace_member(p.workspace_id, 'user'::system_profile) 
        AND pipeline_cards.responsible_user_id = current_system_user_id()
      )
    )
  )
);