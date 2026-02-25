-- Permitir que a edge function manage system_user_cargos sem restrições de RLS
DROP POLICY IF EXISTS "Service role can manage system_user_cargos" ON public.system_user_cargos;

-- Criar nova política mais permissiva para service role
CREATE POLICY "Allow all operations for service role" 
ON public.system_user_cargos 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- Permitir operações para usuários autenticados (temporariamente para debug)
CREATE POLICY "Allow authenticated users to manage cargos" 
ON public.system_user_cargos 
FOR ALL 
TO authenticated
USING (true) 
WITH CHECK (true);