-- Criar funções de segurança para evitar recursão RLS

-- Função para verificar se o usuário atual é master
CREATE OR REPLACE FUNCTION public.is_current_user_master()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.email = (auth.jwt() ->> 'email'::text) 
    AND su.profile = 'master'
  );
END;
$$;

-- Função para verificar se o usuário atual é admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.email = (auth.jwt() ->> 'email'::text) 
    AND su.profile = 'admin'
  );
END;
$$;

-- Função para obter o perfil do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile text;
BEGIN
  SELECT su.profile INTO user_profile
  FROM public.system_users su 
  WHERE su.email = (auth.jwt() ->> 'email'::text);
  
  RETURN COALESCE(user_profile, 'user');
END;
$$;

-- Recriar política RLS para clientes usando as funções de segurança
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (
  is_member(org_id) 
  AND (
    -- Se é usuário master, pode ver tudo
    public.is_current_user_master()
    OR (
      -- Se é admin, pode ver tudo EXCETO o cliente master
      public.is_current_user_admin() AND email != 'adm@tezeus.com'
    )
    OR (
      -- Usuários comuns podem ver todos os clientes normalmente  
      NOT (public.is_current_user_master() OR public.is_current_user_admin())
    )
  )
);

-- Recriar política RLS para system_users usando as funções de segurança
DROP POLICY IF EXISTS "Service role can manage system_users" ON public.system_users;

CREATE POLICY "Service role can manage system_users" 
ON public.system_users 
FOR ALL 
USING (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text 
  OR public.is_current_user_master()
  OR (public.is_current_user_admin() AND profile != 'master')
  OR (email = (auth.jwt() ->> 'email'::text))
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text 
  OR public.is_current_user_master()
);