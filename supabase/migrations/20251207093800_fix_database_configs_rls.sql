-- Corrigir política RLS para permitir leitura de configurações
-- Esta migration corrige a política para funcionar com o sistema de autenticação customizado

-- Remover política antiga
DROP POLICY IF EXISTS "Authenticated users can view database configs" ON public.database_configs;

-- Criar nova política mais permissiva para leitura
-- Permite leitura para qualquer usuário autenticado (via Supabase auth ou sistema customizado)
CREATE POLICY "Authenticated users can view database configs"
  ON public.database_configs
  FOR SELECT
  USING (
    -- Permitir se estiver autenticado via Supabase
    auth.role() = 'authenticated'
    OR
    -- Permitir se tiver um usuário do sistema identificado
    public.current_system_user_id() IS NOT NULL
    OR
    -- Permitir se tiver JWT com informações do sistema
    (auth.jwt() ->> 'system_user_id') IS NOT NULL
    OR
    (auth.jwt() ->> 'x-system-user-id') IS NOT NULL
  );

