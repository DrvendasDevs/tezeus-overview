-- ============================================
-- MIGRATION: Remover tabela database_configs
-- Esta migration remove a tabela e todas as dependências relacionadas
-- ============================================

BEGIN;

-- 1. Remover triggers relacionados
DROP TRIGGER IF EXISTS ensure_single_database_config ON public.database_configs;
DROP TRIGGER IF EXISTS ensure_single_active_database_trigger ON public.database_configs;
DROP TRIGGER IF EXISTS update_database_configs_updated_at ON public.database_configs;

-- 2. Remover funções relacionadas
DROP FUNCTION IF EXISTS public.ensure_single_database_config();
DROP FUNCTION IF EXISTS public.ensure_single_active_database();
DROP FUNCTION IF EXISTS public.update_database_configs_updated_at();

-- 3. Remover políticas RLS
DROP POLICY IF EXISTS "Authenticated users can view database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can insert database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can update database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can delete database configs" ON public.database_configs;

-- 4. Remover índices
DROP INDEX IF EXISTS public.idx_database_configs_name;
DROP INDEX IF EXISTS public.idx_database_configs_active;

-- 5. Remover a tabela
DROP TABLE IF EXISTS public.database_configs;

COMMIT;























