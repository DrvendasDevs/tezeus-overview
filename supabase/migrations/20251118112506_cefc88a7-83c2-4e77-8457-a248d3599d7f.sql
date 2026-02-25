-- Função para atualizar senha de usuário com hash bcrypt
CREATE OR REPLACE FUNCTION public.update_user_password(user_email text, new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.system_users
  SET senha = extensions.crypt(new_password, extensions.gen_salt('bf'))
  WHERE email = user_email;
  
  RETURN FOUND;
END;
$$;

-- Atualizar a senha do usuário erikarangel@gmail.com para 'luaakiresk8'
SELECT public.update_user_password('erikarangel@gmail.com', 'luaakiresk8');