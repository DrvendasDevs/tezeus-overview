-- Criar tabela para relacionamento entre usuários e cargos (múltiplos cargos por usuário)
CREATE TABLE public.system_user_cargos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, cargo_id)
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.system_user_cargos ENABLE ROW LEVEL SECURITY;

-- Criar políticas para a nova tabela
CREATE POLICY "Service role can manage system_user_cargos" 
ON public.system_user_cargos 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Migrar dados existentes (se houver)
INSERT INTO public.system_user_cargos (user_id, cargo_id)
SELECT id, cargo_id 
FROM public.system_users 
WHERE cargo_id IS NOT NULL;

-- Opcional: Remover a coluna cargo_id da tabela system_users após a migração
-- ALTER TABLE public.system_users DROP COLUMN cargo_id;