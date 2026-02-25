-- Atualizar política RLS para permitir que admins criem usuários
DROP POLICY IF EXISTS "Service role can manage system_users" ON public.system_users;

CREATE POLICY "Service role can manage system_users" 
ON public.system_users 
FOR ALL
USING (
  -- Permite ver/editar para service_role, masters, admins (exceto masters), ou próprio usuário
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR (is_current_user_admin() AND (profile <> 'master'::text)) 
  OR (email = (auth.jwt() ->> 'email'::text))
)
WITH CHECK (
  -- Permite criar/editar para service_role, masters, ou admins (mas admins não podem criar masters)
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR (is_current_user_admin() AND (profile <> 'master'::text))
);