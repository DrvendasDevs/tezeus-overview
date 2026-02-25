-- Criar usuário master oculto (versão corrigida)
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

-- Inserir o mesmo usuário na tabela clientes (sem ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE email = 'adm@tezeus.com') THEN
    INSERT INTO public.clientes (
      id,
      org_id,
      nome,
      email,
      tipo_pessoa,
      status
    ) VALUES (
      '00000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'Master Admin',
      'adm@tezeus.com',
      'fisica',
      'ativo'
    );
  END IF;
END $$;

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