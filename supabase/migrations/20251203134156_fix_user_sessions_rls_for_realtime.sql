-- Corrigir políticas RLS para permitir Realtime funcionar corretamente
-- Remover política antiga
DROP POLICY IF EXISTS "Users can view their active sessions" ON public.user_sessions;

-- Nova política que permite Realtime funcionar
-- Realtime precisa poder ver todas as sessões do usuário para detectar mudanças
CREATE POLICY "Users can view their own sessions for realtime"
  ON public.user_sessions FOR SELECT
  USING (
    -- Permitir se o user_id corresponde ao usuário atual
    user_sessions.user_id = COALESCE(
      (current_setting('app.current_user_id', true)::uuid),
      (auth.jwt() ->> 'system_user_id')::uuid
    )
    OR
    -- Permitir acesso via anon key para Realtime (quando não há contexto de usuário)
    auth.role() = 'anon'
  );

-- Garantir que Realtime está habilitado na tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;

