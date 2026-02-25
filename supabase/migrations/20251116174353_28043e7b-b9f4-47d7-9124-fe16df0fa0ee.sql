-- Criar função para atualizar senha do usuário logado
CREATE OR REPLACE FUNCTION public.update_my_password(new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Obter ID do usuário logado
  user_id := current_system_user_id();
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Validar senha
  IF new_password IS NULL OR LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres';
  END IF;
  
  -- Atualizar senha (o trigger hash_password_trigger fará o hash automaticamente)
  UPDATE public.system_users
  SET 
    senha = new_password,
    updated_at = NOW()
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  
  RETURN TRUE;
END;
$$;