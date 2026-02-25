-- Atualizar função de login para usar verificação segura de senha
CREATE OR REPLACE FUNCTION public.get_system_user(user_email text, user_password text)
RETURNS TABLE(id uuid, name text, email text, profile text, status text, avatar text, cargo_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.name,
    su.email,
    su.profile,
    su.status,
    su.avatar,
    su.cargo_id,
    su.created_at,
    su.updated_at
  FROM public.system_users su
  WHERE su.email = user_email 
    AND su.senha IS NOT NULL
    AND public.verify_password(user_password, su.senha);
END;
$$;