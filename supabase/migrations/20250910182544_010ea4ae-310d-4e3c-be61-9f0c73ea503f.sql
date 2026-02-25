-- Atualizar política de inserção de mensagens para permitir service_role
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY "messages_insert_service_and_members" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  -- Permitir service_role (para edge functions)
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR 
  -- Permitir membros do workspace
  is_workspace_member(workspace_id, 'user'::system_profile)
);