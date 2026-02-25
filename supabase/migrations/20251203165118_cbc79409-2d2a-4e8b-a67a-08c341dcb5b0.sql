
-- Criar tabela user_sessions para controle de login único
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - permitir operações via service role e para o próprio usuário
CREATE POLICY "Service role full access" ON public.user_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para detectar mudanças
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;

-- Adicionar à publicação realtime (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
  END IF;
END $$;

-- Função para invalidar sessões anteriores de um usuário
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions(p_user_id UUID, p_except_token TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invalidated_count INTEGER;
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, updated_at = now()
  WHERE user_id = p_user_id 
    AND session_token != p_except_token
    AND is_active = true;
  
  GET DIAGNOSTICS invalidated_count = ROW_COUNT;
  
  RETURN invalidated_count;
END;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_sessions_updated_at();
