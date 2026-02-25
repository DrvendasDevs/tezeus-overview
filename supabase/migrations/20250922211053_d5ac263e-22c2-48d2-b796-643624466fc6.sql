-- Enable RLS on pipeline-related tables
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;

-- Pipeline policies
CREATE POLICY "Users can view pipelines in their workspace" 
ON public.pipelines 
FOR SELECT 
USING (
  public.is_workspace_member(workspace_id, 'user'::system_profile)
);

CREATE POLICY "Users can create pipelines in their workspace" 
ON public.pipelines 
FOR INSERT 
WITH CHECK (
  public.is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "Users can update pipelines in their workspace" 
ON public.pipelines 
FOR UPDATE 
USING (
  public.is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Pipeline columns policies
CREATE POLICY "Users can view pipeline columns from their workspace" 
ON public.pipeline_columns 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'user'::system_profile)
  )
);

CREATE POLICY "Users can create pipeline columns in their workspace" 
ON public.pipeline_columns 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'admin'::system_profile)
  )
);

CREATE POLICY "Users can update pipeline columns in their workspace" 
ON public.pipeline_columns 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'admin'::system_profile)
  )
);

-- Pipeline cards policies
CREATE POLICY "Users can view pipeline cards from their workspace" 
ON public.pipeline_cards 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'user'::system_profile)
  )
);

CREATE POLICY "Users can create pipeline cards in their workspace" 
ON public.pipeline_cards 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'user'::system_profile)
  )
);

CREATE POLICY "Users can update pipeline cards in their workspace" 
ON public.pipeline_cards 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'user'::system_profile)
  )
);

CREATE POLICY "Users can delete pipeline cards from their workspace" 
ON public.pipeline_cards 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND public.is_workspace_member(p.workspace_id, 'user'::system_profile)
  )
);