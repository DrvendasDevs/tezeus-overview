-- Habilitar Row Level Security na tabela notifications
-- Isso ativará as políticas RLS já existentes que usam funções SECURITY DEFINER
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;