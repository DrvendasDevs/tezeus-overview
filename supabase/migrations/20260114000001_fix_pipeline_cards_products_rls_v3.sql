-- Corrigir políticas de RLS para pipeline_cards_products
-- Versão 3: Usar workspace_id diretamente (já que está sendo passado no INSERT)

-- Primeiro, dropar TODAS as políticas existentes na tabela
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

-- Habilitar RLS
ALTER TABLE public.pipeline_cards_products ENABLE ROW LEVEL SECURITY;

-- Política SELECT - verificar via workspace_id OU via pipeline_card
CREATE POLICY "pcp_select_policy"
ON public.pipeline_cards_products
FOR SELECT
USING (
  -- Verificar diretamente pelo workspace_id da linha
  workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
  OR
  -- Fallback: verificar via pipeline_card -> pipeline -> workspace
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);

-- Política INSERT - verificar se o usuário pertence ao workspace informado
CREATE POLICY "pcp_insert_policy"
ON public.pipeline_cards_products
FOR INSERT
WITH CHECK (
  -- Verificar se o workspace_id informado pertence ao usuário
  workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
);

-- Política UPDATE - mesmo critério do SELECT
CREATE POLICY "pcp_update_policy"
ON public.pipeline_cards_products
FOR UPDATE
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);

-- Política DELETE - mesmo critério do SELECT
CREATE POLICY "pcp_delete_policy"
ON public.pipeline_cards_products
FOR DELETE
USING (
  workspace_id IN (
    SELECT wm.workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);
