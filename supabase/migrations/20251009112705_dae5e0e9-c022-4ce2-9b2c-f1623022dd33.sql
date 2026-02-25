-- Garantir que RLS está habilitado na tabela pipeline_actions
ALTER TABLE pipeline_actions ENABLE ROW LEVEL SECURITY;

-- Log de confirmação
DO $$
BEGIN
  RAISE NOTICE 'RLS habilitado em pipeline_actions';
END $$;