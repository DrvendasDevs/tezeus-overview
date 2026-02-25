-- Corrigir política RLS para clientes - garantir que master sempre veja tudo
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (
  is_member(org_id) 
  AND (
    -- Se é usuário master, pode ver TODOS os clientes (inclusive ele mesmo)
    public.is_current_user_master()
    OR (
      -- Usuários não-master não podem ver o cliente com email master
      email != 'adm@tezeus.com'
    )
  )
);

-- Corrigir política RLS para system_users - impedir que admin veja master
DROP POLICY IF EXISTS "Service role can manage system_users" ON public.system_users;

CREATE POLICY "Service role can manage system_users" 
ON public.system_users 
FOR ALL 
USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR public.is_current_user_master() 
  OR (
    public.is_current_user_admin() 
    AND profile != 'master'  -- Admin não pode ver usuários master
  ) 
  OR (email = (auth.jwt() ->> 'email'::text))
) 
WITH CHECK (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR public.is_current_user_master()
);