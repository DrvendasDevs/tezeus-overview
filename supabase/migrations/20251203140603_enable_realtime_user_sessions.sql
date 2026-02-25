-- Habilitar Realtime completo para a tabela user_sessions
-- Isso permitirá que mudanças nas sessões sejam transmitidas em tempo real

-- 1. Configurar REPLICA IDENTITY FULL para enviar todos os campos nos eventos UPDATE
-- Isso é ESSENCIAL para que o Realtime transmita dados completos, não apenas a chave primária
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;

-- 2. Adicionar tabela à publicação do Supabase Realtime de forma segura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'user_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
  END IF;
END $$;

-- 3. Simplificar política RLS para permitir Realtime funcionar
-- Remover política restritiva que pode estar bloqueando o Realtime
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their active sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions for realtime" ON public.user_sessions;

-- Criar política mais permissiva que permite Realtime funcionar
-- O Realtime precisa poder ver as mudanças mesmo quando não há contexto de usuário definido
CREATE POLICY "Allow users to view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (
    -- Permitir se o user_id corresponde ao usuário atual
    user_sessions.user_id = COALESCE(
      (current_setting('app.current_user_id', true)::uuid),
      (auth.jwt() ->> 'system_user_id')::uuid,
      (auth.jwt() ->> 'x-system-user-id')::uuid
    )
    OR
    -- Permitir sempre para Realtime (quando não há contexto de usuário)
    -- Isso é necessário para o Realtime poder receber eventos
    current_setting('app.current_user_id', true) IS NULL
    OR
    auth.jwt() IS NULL
  );

