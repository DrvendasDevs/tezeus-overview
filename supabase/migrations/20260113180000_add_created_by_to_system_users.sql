-- Adicionar coluna created_by na tabela system_users para rastrear quem criou cada usuário
ALTER TABLE public.system_users
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.system_users(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_system_users_created_by ON public.system_users(created_by);

-- Atualizar a view system_users_view para incluir o nome de quem criou
DROP VIEW IF EXISTS public.system_users_view;

CREATE VIEW public.system_users_view AS
SELECT 
  su.id,
  su.name,
  su.email,
  su.profile,
  su.status,
  su.avatar,
  su.phone,
  su.default_channel,
  su.created_at,
  su.updated_at,
  su.created_by,
  creator.name AS created_by_name,
  COALESCE(
    (
      SELECT array_agg(suc.cargo_id)
      FROM system_user_cargos suc
      WHERE suc.user_id = su.id
    ),
    ARRAY[]::uuid[]
  ) AS cargo_ids
FROM system_users su
LEFT JOIN system_users creator ON creator.id = su.created_by;

-- Comentário explicativo
COMMENT ON COLUMN public.system_users.created_by IS 'ID do usuário que criou este usuário';
