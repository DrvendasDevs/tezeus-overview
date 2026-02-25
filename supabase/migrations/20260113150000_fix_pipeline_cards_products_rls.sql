-- Corrigir políticas de RLS para pipeline_cards_products
-- Permite que todos os usuários do workspace possam gerenciar produtos vinculados aos cards

-- Primeiro, dropar políticas existentes se houver
DROP POLICY IF EXISTS "Users can view pipeline_cards_products in their workspace" ON public.pipeline_cards_products;
DROP POLICY IF EXISTS "Users can insert pipeline_cards_products in their workspace" ON public.pipeline_cards_products;
DROP POLICY IF EXISTS "Users can update pipeline_cards_products in their workspace" ON public.pipeline_cards_products;
DROP POLICY IF EXISTS "Users can delete pipeline_cards_products in their workspace" ON public.pipeline_cards_products;

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.pipeline_cards_products ENABLE ROW LEVEL SECURITY;

-- Política de SELECT: usuários podem ver produtos de cards do seu workspace
CREATE POLICY "Users can view pipeline_cards_products in their workspace"
ON public.pipeline_cards_products
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND p.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Política de INSERT: usuários podem adicionar produtos a cards do seu workspace
CREATE POLICY "Users can insert pipeline_cards_products in their workspace"
ON public.pipeline_cards_products
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND p.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Política de UPDATE: usuários podem atualizar produtos de cards do seu workspace
CREATE POLICY "Users can update pipeline_cards_products in their workspace"
ON public.pipeline_cards_products
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND p.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);

-- Política de DELETE: usuários podem remover produtos de cards do seu workspace
CREATE POLICY "Users can delete pipeline_cards_products in their workspace"
ON public.pipeline_cards_products
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members 
    WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.pipeline_cards pc
    JOIN public.pipelines p ON pc.pipeline_id = p.id
    WHERE pc.id = pipeline_cards_products.pipeline_card_id
    AND p.workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  )
);
