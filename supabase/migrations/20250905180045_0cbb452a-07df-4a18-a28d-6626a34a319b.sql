-- Criar usuário master oculto (versão simplificada)
-- Inserir na tabela system_users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_users WHERE email = 'adm@tezeus.com') THEN
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
    );
  END IF;
END $$;

-- Inserir o mesmo usuário na tabela clientes
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

-- Criar uma role para o usuário master no sistema de autenticação
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
    INSERT INTO public.user_roles (user_id, role) 
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'master'::app_role);
  END IF;
END $$;