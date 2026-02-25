-- Corrigir políticas de RLS para pipeline_cards_products
-- Versão 2: Políticas mais permissivas para garantir que todos os usuários do workspace
-- possam adicionar, visualizar, editar e remover produtos vinculados aos cards

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

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.pipeline_cards_products ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: usuários podem ver produtos de cards de pipelines do seu workspace
CREATE POLICY "pcp_select_v2"
ON public.pipeline_cards_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);

-- Política de INSERT: usuários podem adicionar produtos a cards de pipelines do seu workspace
CREATE POLICY "pcp_insert_v2"
ON public.pipeline_cards_products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);

-- Política de UPDATE: usuários podem atualizar produtos de cards de pipelines do seu workspace
CREATE POLICY "pcp_update_v2"
ON public.pipeline_cards_products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);

-- Política de DELETE: usuários podem remover produtos de cards de pipelines do seu workspace
CREATE POLICY "pcp_delete_v2"
ON public.pipeline_cards_products
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    JOIN public.workspace_members wm ON p.workspace_id = wm.workspace_id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND wm.user_id = auth.uid()
  )
);
