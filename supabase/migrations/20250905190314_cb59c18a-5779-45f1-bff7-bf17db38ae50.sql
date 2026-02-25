-- Corrigir política RLS para clientes - master não precisa estar em org_members
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (
  -- Se é usuário master, pode ver TODOS os clientes sem verificar org_members
  public.is_current_user_master()
  OR (
    -- Para outros usuários, precisa ser membro da org E não pode ver o master
    is_member(org_id) AND email != 'adm@tezeus.com'
  )
);