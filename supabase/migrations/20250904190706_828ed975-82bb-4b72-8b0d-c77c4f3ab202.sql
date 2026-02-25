-- Drop and recreate the system_users_view with cargo_ids array
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
  COALESCE(
    ARRAY_AGG(suc.cargo_id) FILTER (WHERE suc.cargo_id IS NOT NULL),
    '{}'::uuid[]
  ) AS cargo_ids
FROM public.system_users su
LEFT JOIN public.system_user_cargos suc ON su.id = suc.user_id
GROUP BY su.id, su.name, su.email, su.profile, su.status, su.avatar, su.cargo_id, su.default_channel, su.created_at, su.updated_at;