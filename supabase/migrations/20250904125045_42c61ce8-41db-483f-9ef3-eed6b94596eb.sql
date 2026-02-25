-- Recriar a view system_users_view para incluir o campo default_channel
DROP VIEW IF EXISTS public.system_users_view;

CREATE VIEW public.system_users_view AS
SELECT 
  id,
  name,
  email,
  profile,
  status,
  avatar,
  cargo_id,
  default_channel,
  created_at,
  updated_at
FROM public.system_users;