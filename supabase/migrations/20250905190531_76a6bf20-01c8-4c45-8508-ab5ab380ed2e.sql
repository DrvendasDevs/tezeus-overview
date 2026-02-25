-- Adicionar usuário master na tabela org_members para org default
INSERT INTO public.org_members (org_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid,
  su.id,
  'OWNER'::org_role
FROM public.system_users su 
WHERE su.email = 'adm@tezeus.com' AND su.profile = 'master'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Simplificar política RLS para clientes - usar apenas is_member
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;

CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (
  is_member(org_id) 
  AND (
    -- Se é usuário master, pode ver tudo
    public.is_current_user_master()
    OR 
    -- Outros usuários não podem ver o cliente master
    email != 'adm@tezeus.com'
  )
);