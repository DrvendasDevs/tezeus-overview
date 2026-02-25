-- Remover SECURITY DEFINER das views para resolver avisos de segurança

-- Recriar system_users_view sem SECURITY DEFINER
DROP VIEW IF EXISTS public.system_users_view;

CREATE VIEW public.system_users_view AS
SELECT 
  su.id,
  su.name, 
  su.email,
  su.profile,
  su.status,
  su.avatar,
  su.cargo_id,
  su.default_channel,
  su.created_at,
  su.updated_at,
  ARRAY_AGG(suc.cargo_id) FILTER (WHERE suc.cargo_id IS NOT NULL) as cargo_ids
FROM public.system_users su
LEFT JOIN public.system_user_cargos suc ON su.id = suc.user_id
GROUP BY su.id, su.name, su.email, su.profile, su.status, su.avatar, su.cargo_id, su.default_channel, su.created_at, su.updated_at;

-- Recriar channels_view sem SECURITY DEFINER  
DROP VIEW IF EXISTS public.channels_view;

CREATE VIEW public.channels_view AS
SELECT 
  c.id,
  c.name,
  c.number,
  c.instance,
  c.status,
  c.created_at,
  c.updated_at,
  c.last_state_at
FROM public.channels c;