-- ============================================
-- MIGRATION COMPLETA: Configuração de Bancos de Dados
-- Execute este script completo na outra base de dados
-- ============================================

BEGIN;

-- ============================================
-- 1. CRIAR TABELA
-- ============================================
CREATE TABLE IF NOT EXISTS public.database_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  project_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 2. CRIAR ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_database_configs_name ON public.database_configs(name);
CREATE INDEX IF NOT EXISTS idx_database_configs_active ON public.database_configs(is_active) WHERE is_active = true;

-- ============================================
-- 3. HABILITAR RLS
-- ============================================
ALTER TABLE public.database_configs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. REMOVER POLÍTICAS ANTIGAS (se existirem)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can insert database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can update database configs" ON public.database_configs;
DROP POLICY IF EXISTS "Masters can delete database configs" ON public.database_configs;

-- ============================================
-- 5. CRIAR POLÍTICAS RLS
-- ============================================

-- Política: Todos os usuários autenticados podem ler as configurações
CREATE POLICY "Authenticated users can view database configs"
  ON public.database_configs
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    OR
    public.current_system_user_id() IS NOT NULL
    OR
    (auth.jwt() ->> 'system_user_id') IS NOT NULL
    OR
    (auth.jwt() ->> 'x-system-user-id') IS NOT NULL
  );

-- Política: Apenas usuários master podem inserir configurações
CREATE POLICY "Masters can insert database configs"
  ON public.database_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  );

-- Política: Apenas usuários master podem atualizar configurações
CREATE POLICY "Masters can update database configs"
  ON public.database_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  );

-- Política: Apenas usuários master podem deletar configurações
CREATE POLICY "Masters can delete database configs"
  ON public.database_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  );

-- ============================================
-- 6. CRIAR FUNÇÕES
-- ============================================

-- Função para garantir que apenas uma configuração esteja ativa
CREATE OR REPLACE FUNCTION public.ensure_single_active_database()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.database_configs
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_database_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CRIAR TRIGGERS
-- ============================================

-- Remover triggers antigos se existirem
DROP TRIGGER IF EXISTS ensure_single_active_database_trigger ON public.database_configs;
DROP TRIGGER IF EXISTS update_database_configs_updated_at ON public.database_configs;

-- Trigger para garantir apenas uma configuração ativa
CREATE TRIGGER ensure_single_active_database_trigger
  BEFORE INSERT OR UPDATE ON public.database_configs
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.ensure_single_active_database();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_database_configs_updated_at
  BEFORE UPDATE ON public.database_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_database_configs_updated_at();

-- ============================================
-- 8. ADICIONAR COMENTÁRIOS
-- ============================================
COMMENT ON TABLE public.database_configs IS 'Configurações de bancos de dados Supabase disponíveis no sistema';
COMMENT ON COLUMN public.database_configs.name IS 'Nome identificador da configuração (ex: "Base 1", "Base 2")';
COMMENT ON COLUMN public.database_configs.url IS 'URL do projeto Supabase';
COMMENT ON COLUMN public.database_configs.anon_key IS 'Chave pública (anon key) do Supabase';
COMMENT ON COLUMN public.database_configs.project_id IS 'ID do projeto Supabase';
COMMENT ON COLUMN public.database_configs.is_active IS 'Indica qual configuração está ativa (apenas uma pode estar ativa)';

-- ============================================
-- 9. INSERIR DADOS INICIAIS
-- ============================================

-- Inserir Base 1 (2.1 tester) - marcada como ativa por padrão
INSERT INTO public.database_configs (name, url, anon_key, project_id, is_active)
VALUES (
  'Base 1',
  'https://zdrgvdlfhrbynpkvtyhx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM',
  'zdrgvdlfhrbynpkvtyhx',
  true
)
ON CONFLICT (name) DO UPDATE 
SET url = EXCLUDED.url,
    anon_key = EXCLUDED.anon_key,
    project_id = EXCLUDED.project_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Inserir Base 2 (2.0 com clientes) - marcada como inativa
INSERT INTO public.database_configs (name, url, anon_key, project_id, is_active)
VALUES (
  'Base 2',
  'https://zldeaozqxjwvzgrblyrh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM',
  'zldeaozqxjwvzgrblyrh',
  false
)
ON CONFLICT (name) DO UPDATE 
SET url = EXCLUDED.url,
    anon_key = EXCLUDED.anon_key,
    project_id = EXCLUDED.project_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Garantir que apenas Base 1 esteja ativa
UPDATE public.database_configs
SET is_active = false, updated_at = now()
WHERE name = 'Base 2' AND is_active = true
AND EXISTS (
  SELECT 1 FROM public.database_configs 
  WHERE name = 'Base 1' AND is_active = true
);

COMMIT;

-- ============================================
-- 10. VERIFICAR RESULTADO
-- ============================================
SELECT 
  id, 
  name, 
  url, 
  project_id, 
  is_active, 
  created_at, 
  updated_at 
FROM public.database_configs 
ORDER BY name;

