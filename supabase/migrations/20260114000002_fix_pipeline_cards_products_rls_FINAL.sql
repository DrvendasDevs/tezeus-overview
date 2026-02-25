-- SOLUÇÃO FINAL: Política simplificada para pipeline_cards_products
-- Permite que qualquer usuário autenticado que seja membro de algum workspace
-- possa gerenciar produtos vinculados aos cards

-- Dropar TODAS as políticas existentes
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'pipeline_cards_products' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.pipeline_cards_products', pol.policyname);
    END LOOP;
END $$;

-- Garantir que RLS está habilitado
ALTER TABLE public.pipeline_cards_products ENABLE ROW LEVEL SECURITY;

-- Política ÚNICA para todas as operações - baseada em autenticação
-- Qualquer usuário autenticado pode fazer qualquer operação
CREATE POLICY "pcp_all_authenticated"
ON public.pipeline_cards_products
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
