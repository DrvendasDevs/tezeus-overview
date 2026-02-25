-- Adicionar coluna created_by na tabela system_users para rastrear quem criou cada usuário
ALTER TABLE public.system_users
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.system_users(id);

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_system_users_created_by ON public.system_users(created_by);

-- Recriar a view system_users_view para incluir o created_by e o nome do criador
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
  su.created_by,
  creator.name as created_by_name,
  ARRAY_AGG(suc.cargo_id) FILTER (WHERE suc.cargo_id IS NOT NULL) as cargo_ids
FROM public.system_users su
LEFT JOIN public.system_user_cargos suc ON su.id = suc.user_id
LEFT JOIN public.system_users creator ON su.created_by = creator.id
GROUP BY su.id, su.name, su.email, su.profile, su.status, su.avatar, su.cargo_id, su.default_channel, su.created_at, su.updated_at, su.created_by, creator.name;
