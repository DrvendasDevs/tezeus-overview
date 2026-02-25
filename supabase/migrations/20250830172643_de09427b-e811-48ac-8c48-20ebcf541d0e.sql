-- Garantir que a extensão pgcrypto está ativa
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION pgcrypto;

-- Recriar as funções após garantir que pgcrypto está disponível
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
  
  -- Se não, gera o hash usando pgcrypto
  RETURN crypt(password, gen_salt('bf', 10));
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

-- Recriar trigger
DROP TRIGGER IF EXISTS hash_password_trigger ON public.system_users;
CREATE TRIGGER hash_password_trigger
  BEFORE INSERT OR UPDATE OF senha ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_user_password();