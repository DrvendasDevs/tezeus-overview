-- Modificar política RLS para system_users - admin não pode ver master
DROP POLICY IF EXISTS "Service role can manage system_users" ON public.system_users;

CREATE POLICY "Service role can manage system_users" 
ON public.system_users 
FOR ALL 
USING (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text 
  OR (
    -- Usuários master podem ver tudo
    EXISTS (
      SELECT 1 FROM public.system_users su 
      WHERE su.email = (auth.jwt() ->> 'email'::text) 
      AND su.profile = 'master'
    )
  )
  OR (
    -- Usuários admin podem ver tudo EXCETO master
    EXISTS (
      SELECT 1 FROM public.system_users su 
      WHERE su.email = (auth.jwt() ->> 'email'::text) 
      AND su.profile = 'admin'
    ) AND profile != 'master'
  )
  OR (
    -- Usuários comuns só veem a si próprios
    email = (auth.jwt() ->> 'email'::text)
  )
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text 
  OR EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.email = (auth.jwt() ->> 'email'::text) 
    AND su.profile = 'master'
  )
);

-- Modificar política RLS para clientes - admin não pode ver master
DROP POLICY IF EXISTS "Allow select for default org" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (
  is_member(org_id) 
  AND (
    -- Se é usuário master, pode ver tudo
    EXISTS (
      SELECT 1 FROM public.system_users su 
      WHERE su.email = (auth.jwt() ->> 'email'::text) 
      AND su.profile = 'master'
    )
    OR (
      -- Se é admin, pode ver tudo EXCETO o cliente master
      EXISTS (
        SELECT 1 FROM public.system_users su 
        WHERE su.email = (auth.jwt() ->> 'email'::text) 
        AND su.profile = 'admin'
      ) AND email != 'adm@tezeus.com'
    )
    OR (
      -- Usuários comuns podem ver todos os clientes normalmente
      NOT EXISTS (
        SELECT 1 FROM public.system_users su 
        WHERE su.email = (auth.jwt() ->> 'email'::text) 
        AND su.profile IN ('master', 'admin')
      )
    )
  )
);