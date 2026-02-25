-- Corrigir política RLS para clientes - permitir que master veja tudo inclusive ele mesmo
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
      -- Se é admin, pode ver tudo EXCETO o cliente master
      public.is_current_user_admin() AND email != 'adm@tezeus.com'
    )
    OR (
      -- Usuários comuns podem ver todos os clientes normalmente (exceto o master)
      NOT (public.is_current_user_master() OR public.is_current_user_admin())
      AND email != 'adm@tezeus.com'
    )
  )
);