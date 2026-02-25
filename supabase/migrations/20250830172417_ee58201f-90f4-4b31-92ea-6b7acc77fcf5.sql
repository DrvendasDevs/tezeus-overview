-- Ativar extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Função para hash da senha usando bcrypt
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se a senha já está hasheada (começa com $2), retorna ela mesma
  IF password ~ '^(\$2[abyxz]?\$|\$2\$)' THEN
    RETURN password;
  END IF;
  
  -- Se não, gera o hash
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(password, hash) = hash;
END;
$$;

-- Trigger function para hash automático de senhas
CREATE OR REPLACE FUNCTION public.hash_user_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se senha foi fornecida, fazer hash
  IF NEW.senha IS NOT NULL AND NEW.senha != '' THEN
    NEW.senha = public.hash_password(NEW.senha);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para hash automático nas inserções e atualizações
DROP TRIGGER IF EXISTS hash_password_trigger ON public.system_users;
CREATE TRIGGER hash_password_trigger
  BEFORE INSERT OR UPDATE OF senha ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_user_password();

-- Atualizar senhas existentes que não estão hasheadas
UPDATE public.system_users 
SET senha = public.hash_password(senha) 
WHERE senha IS NOT NULL 
  AND senha != '' 
  AND senha !~ '^(\$2[abyxz]?\$|\$2\$)';