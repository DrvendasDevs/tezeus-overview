-- Criar tabela para configurações de bancos de dados
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_database_configs_name ON public.database_configs(name);
CREATE INDEX IF NOT EXISTS idx_database_configs_active ON public.database_configs(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.database_configs ENABLE ROW LEVEL SECURITY;

-- Política: Todos os usuários autenticados podem ler as configurações
-- Permite leitura para usuários autenticados via JWT ou sistema customizado
CREATE POLICY "Authenticated users can view database configs"
  ON public.database_configs
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    OR public.current_system_user_id() IS NOT NULL
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

-- Função para garantir que apenas uma configuração esteja ativa
CREATE OR REPLACE FUNCTION public.ensure_single_active_database()
RETURNS TRIGGER AS $$
BEGIN
  -- Se estamos ativando uma nova configuração, desativar todas as outras
  IF NEW.is_active = true THEN
    UPDATE public.database_configs
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para garantir apenas uma configuração ativa
CREATE TRIGGER ensure_single_active_database_trigger
  BEFORE INSERT OR UPDATE ON public.database_configs
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.ensure_single_active_database();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_database_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_database_configs_updated_at
  BEFORE UPDATE ON public.database_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_database_configs_updated_at();

-- Comentários
COMMENT ON TABLE public.database_configs IS 'Configurações de bancos de dados Supabase disponíveis no sistema';
COMMENT ON COLUMN public.database_configs.name IS 'Nome identificador da configuração (ex: "Base 1", "Base 2")';
COMMENT ON COLUMN public.database_configs.url IS 'URL do projeto Supabase';
COMMENT ON COLUMN public.database_configs.anon_key IS 'Chave pública (anon key) do Supabase';
COMMENT ON COLUMN public.database_configs.project_id IS 'ID do projeto Supabase';
COMMENT ON COLUMN public.database_configs.is_active IS 'Indica qual configuração está ativa (apenas uma pode estar ativa)';

