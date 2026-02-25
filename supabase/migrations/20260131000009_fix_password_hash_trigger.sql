-- =============================================
-- Migração: Corrigir trigger de hash de senha
-- =============================================
-- O trigger anterior fazia hash mesmo de senhas já hasheadas,
-- causando hash duplo e impossibilitando o login.

-- Recriar a função do trigger com verificação de hash existente
CREATE OR REPLACE FUNCTION public.hash_user_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se senha foi fornecida e não está vazia
  IF NEW.senha IS NOT NULL AND NEW.senha != '' THEN
    -- Verificar se a senha já está hasheada (bcrypt começa com $2)
    -- Se já está hasheada, não fazer hash novamente
    IF NEW.senha !~ '^\$2[abyxz]?\$' THEN
      NEW.senha = public.hash_password(NEW.senha);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.hash_user_password() IS 'Trigger que faz hash de senhas apenas se não estiverem já hasheadas. Evita hash duplo.';
