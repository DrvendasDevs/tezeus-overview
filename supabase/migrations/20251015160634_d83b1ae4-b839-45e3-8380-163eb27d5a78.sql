-- ✅ HABILITAR RLS na tabela pipeline_cards
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;

-- 🔐 POLICY 1: Usuários podem visualizar cards dos seus workspaces
CREATE POLICY "Users can view pipeline cards in their workspace"
ON public.pipeline_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  )
);

-- 🔐 POLICY 2: Usuários podem criar cards nos seus workspaces
CREATE POLICY "Users can create pipeline cards in their workspace"
ON public.pipeline_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  )
);

-- 🔐 POLICY 3: Usuários podem atualizar cards dos seus workspaces
CREATE POLICY "Users can update pipeline cards in their workspace"
ON public.pipeline_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  )
);

-- 🔐 POLICY 4: Admins podem deletar cards dos seus workspaces
CREATE POLICY "Admins can delete pipeline cards in their workspace"
ON public.pipeline_cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
);