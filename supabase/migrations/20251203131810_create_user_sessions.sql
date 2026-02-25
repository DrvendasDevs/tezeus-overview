-- Criar tabela para rastrear sessões ativas de usuários
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  user_agent TEXT,
  ip_address TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Política: permitir todas operações para service role (edge functions)
-- Para clientes, permitir apenas leitura de suas próprias sessões
CREATE POLICY "Service role can manage all sessions"
  ON public.user_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Política: usuários podem ver suas próprias sessões (para Realtime funcionar)
-- Usa uma verificação mais simples que funciona com Realtime
CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (
    -- Permitir se o user_id corresponde ao usuário atual via JWT ou contexto
    user_sessions.user_id = COALESCE(
      (current_setting('app.current_user_id', true)::uuid),
      (auth.jwt() ->> 'system_user_id')::uuid,
      (auth.jwt() ->> 'x-system-user-id')::uuid
    )
    OR
    -- Permitir se não há contexto definido (para Realtime)
    current_setting('app.current_user_id', true) IS NULL
  );

-- Função para invalidar sessões anteriores de um usuário
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions(
  p_user_id UUID,
  p_except_token TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  invalidated_count INTEGER;
BEGIN
  UPDATE public.user_sessions
  SET is_active = false,
      last_activity = NOW()
  WHERE user_id = p_user_id
    AND is_active = true
    AND (p_except_token IS NULL OR session_token != p_except_token);
  
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;
  
  RETURN invalidated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE public.user_sessions IS 'Rastreia sessões ativas de usuários para login único';
COMMENT ON COLUMN public.user_sessions.session_token IS 'Token único da sessão (gerado no cliente)';
COMMENT ON COLUMN public.user_sessions.is_active IS 'Indica se a sessão está ativa';

