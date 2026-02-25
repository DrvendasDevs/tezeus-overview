-- ============================================
-- MIGRATION: Simplificar database_configs para uma única configuração
-- Garante que há apenas uma configuração na tabela
-- ============================================

BEGIN;

-- 1. Se houver múltiplas configurações, manter apenas a mais recente (maior updated_at)
--    Se não houver updated_at, manter a mais recente por created_at
DO $$
DECLARE
  config_count INTEGER;
  latest_config_id UUID;
BEGIN
  -- Contar quantas configurações existem
  SELECT COUNT(*) INTO config_count FROM public.database_configs;
  
  IF config_count > 1 THEN
    -- Encontrar a configuração mais recente
    SELECT id INTO latest_config_id
    FROM public.database_configs
    ORDER BY 
      COALESCE(updated_at, created_at) DESC,
      created_at DESC
    LIMIT 1;
    
    -- Deletar todas as outras configurações
    DELETE FROM public.database_configs
    WHERE id != latest_config_id;
    
    RAISE NOTICE 'Múltiplas configurações encontradas. Mantida apenas a mais recente (ID: %)', latest_config_id;
  END IF;
END $$;

-- 2. Garantir que a configuração restante tenha is_active = true
UPDATE public.database_configs
SET is_active = true, updated_at = now()
WHERE is_active = false OR is_active IS NULL;

-- 3. Adicionar constraint para garantir apenas uma configuração (se não existir)
--    Nota: PostgreSQL não suporta CHECK constraint com COUNT, então usamos trigger
DO $$
BEGIN
  -- Remover trigger antigo se existir
  DROP TRIGGER IF EXISTS ensure_single_database_config ON public.database_configs;
  
  -- Remover função antiga se existir
  DROP FUNCTION IF EXISTS public.ensure_single_database_config();
END $$;

-- 4. Criar função para garantir apenas uma configuração
CREATE OR REPLACE FUNCTION public.ensure_single_database_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Se já existe outra configuração (diferente da que está sendo inserida/atualizada), deletar
  DELETE FROM public.database_configs
  WHERE id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para garantir apenas uma configuração
CREATE TRIGGER ensure_single_database_config
  AFTER INSERT OR UPDATE ON public.database_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_database_config();

-- 6. Comentário na tabela
COMMENT ON TABLE public.database_configs IS 'Configuração única do banco de dados Supabase. Apenas uma configuração deve existir nesta tabela.';

COMMIT;

