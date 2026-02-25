-- Corrigir política RLS para ser mais restritiva - usuários comuns só veem seus próprios cards
DROP POLICY IF EXISTS "Users can view pipeline cards based on responsibility_v2" ON pipeline_cards;

CREATE POLICY "Users can view pipeline cards based on responsibility_v3" 
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
        AND pipeline_cards.responsible_user_id IS NOT NULL
      )
    )
  )
);

-- Atualizar cards que não têm responsável para ter o responsável baseado na conversa
UPDATE pipeline_cards 
SET responsible_user_id = c.assigned_user_id,
    updated_at = NOW()
FROM conversations c
WHERE pipeline_cards.conversation_id = c.id
  AND pipeline_cards.responsible_user_id IS NULL
  AND c.assigned_user_id IS NOT NULL;