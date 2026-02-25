-- =============================================
-- Migração: Criar VIEW para motivos de perda
-- =============================================
-- Objetivo: Melhorar a estabilidade e performance do carregamento dos motivos de perda
-- através de uma VIEW que materializa os dados e simplifica as políticas RLS.

-- Criar a VIEW
CREATE OR REPLACE VIEW public.loss_reasons_view AS
SELECT 
  lr.id,
  lr.name,
  lr.workspace_id,
  lr.is_active,
  lr.created_at,
  lr.updated_at,
  w.name as workspace_name
FROM public.loss_reasons lr
LEFT JOIN public.workspaces w ON w.id = lr.workspace_id;

-- Comentário da VIEW
COMMENT ON VIEW public.loss_reasons_view IS 'View para motivos de perda com nome do workspace incluído. Melhora performance de leitura.';

-- Habilitar RLS na VIEW não é possível diretamente, mas a VIEW herda as políticas da tabela base
-- Para garantir acesso, vamos criar políticas na tabela base se não existirem

-- Verificar e criar política de SELECT para usuários autenticados
DO $$
BEGIN
  -- Política para SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'loss_reasons' 
    AND policyname = 'loss_reasons_select_policy'
  ) THEN
    CREATE POLICY loss_reasons_select_policy ON public.loss_reasons
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT workspace_id FROM system_users WHERE id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM system_users WHERE id = auth.uid() AND profile = 'master'
        )
      );
  END IF;
END $$;

-- Garantir que a VIEW tenha permissão de acesso
GRANT SELECT ON public.loss_reasons_view TO authenticated;
GRANT SELECT ON public.loss_reasons_view TO anon;
