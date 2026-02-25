-- Criar usuário master oculto
-- Primeiro, inserir na tabela system_users
INSERT INTO public.system_users (
  id,
  name,
  email,
  profile,
  status,
  senha
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Master Admin',
  'adm@tezeus.com',
  'master',
  'active',
  public.hash_password('adm123')
) ON CONFLICT (email) DO NOTHING;

-- Inserir o mesmo usuário na tabela clientes
INSERT INTO public.clientes (
  id,
  org_id,
  nome,
  email,
  telefone,
  tipo_pessoa,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Master Admin',
  'adm@tezeus.com',
  null,
  'fisica',
  'ativo'
) ON CONFLICT DO NOTHING;

-- Modificar RLS policy da tabela system_users para esconder o usuário master
DROP POLICY IF EXISTS "Service role can manage system_users" ON public.system_users;

CREATE POLICY "Service role can manage system_users" ON public.system_users
FOR ALL
USING (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
  AND (
    -- Se for o próprio usuário master, pode ver a si mesmo
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    -- Outros usuários não podem ver o master
    (id != '00000000-0000-0000-0000-000000000001'::uuid)
  )
)
WITH CHECK (
  (auth.jwt() ->> 'role'::text) = 'service_role'::text
  AND (
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    (id != '00000000-0000-0000-0000-000000000001'::uuid)
  )
);

-- Modificar RLS policies da tabela clientes para esconder o cliente master
DROP POLICY IF EXISTS "Allow select for default org" ON public.clientes;
DROP POLICY IF EXISTS "Allow insert for default org" ON public.clientes;
DROP POLICY IF EXISTS "Allow update for default org" ON public.clientes;
DROP POLICY IF EXISTS "Allow delete for default org" ON public.clientes;

CREATE POLICY "Allow select for default org" ON public.clientes
FOR SELECT
USING (
  org_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    -- Se for o próprio usuário master logado, pode ver a si mesmo
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    -- Outros usuários não podem ver o cliente master
    (id != '00000000-0000-0000-0000-000000000002'::uuid)
  )
);

CREATE POLICY "Allow insert for default org" ON public.clientes
FOR INSERT
WITH CHECK (
  org_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    (id != '00000000-0000-0000-0000-000000000002'::uuid)
  )
);

CREATE POLICY "Allow update for default org" ON public.clientes
FOR UPDATE
USING (
  org_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    (id != '00000000-0000-0000-0000-000000000002'::uuid)
  )
);

CREATE POLICY "Allow delete for default org" ON public.clientes
FOR DELETE
USING (
  org_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (
    (auth.uid() = '00000000-0000-0000-0000-000000000001'::uuid) 
    OR 
    (id != '00000000-0000-0000-0000-000000000002'::uuid)
  )
);

-- Criar uma role para o usuário master no sistema de autenticação
INSERT INTO public.user_roles (user_id, role) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'master'::app_role)
ON CONFLICT DO NOTHING;