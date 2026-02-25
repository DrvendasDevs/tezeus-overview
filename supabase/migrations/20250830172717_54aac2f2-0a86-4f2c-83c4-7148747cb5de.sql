-- Mover extensão pgcrypto para o schema extensions
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Recriar as funções referenciando as funções do schema correto
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se a senha já está hasheada (começa com $2), retorna ela mesma
  IF password ~ '^(\$2[abyxz]?\$|\$2\$)' THEN
    RETURN password;
  END IF;
  
  -- Se não, gera o hash usando pgcrypto do schema extensions
  RETURN extensions.crypt(password, extensions.gen_salt('bf', 10));
END;
$$;

-- Recriar função de verificação
CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN extensions.crypt(password, hash) = hash;
END;
$$;

-- Recriar trigger function
CREATE OR REPLACE FUNCTION public.hash_user_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se senha foi fornecida, fazer hash
  IF NEW.senha IS NOT NULL AND NEW.senha != '' THEN
    NEW.senha = public.hash_password(NEW.senha);
  END IF;
  
  RETURN NEW;
END;
$$;