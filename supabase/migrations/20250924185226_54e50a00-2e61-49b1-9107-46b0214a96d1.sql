-- Add responsible_user_id column to pipeline_cards table
ALTER TABLE public.pipeline_cards 
ADD COLUMN responsible_user_id uuid REFERENCES public.system_users(id);

-- Create index for better performance on responsible_user_id queries
CREATE INDEX idx_pipeline_cards_responsible_user_id ON public.pipeline_cards(responsible_user_id);

-- Update RLS policies for pipeline_cards to include responsibility-based filtering
-- Drop existing policies first
DROP POLICY IF EXISTS "Masters and admins can manage pipeline cards in their workspace" ON public.pipeline_cards;
DROP POLICY IF EXISTS "Users can view pipeline cards in their workspace" ON public.pipeline_cards;

-- Create new policies with responsibility-based filtering
CREATE POLICY "Masters and admins can manage pipeline cards in their workspace"
ON public.pipeline_cards
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  )
);

-- Users can view only their own cards and unassigned cards
CREATE POLICY "Users can view pipeline cards based on responsibility"
ON public.pipeline_cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
      OR (
        is_workspace_member(p.workspace_id, 'user'::system_profile)
        AND (
          responsible_user_id IS NULL  -- Unassigned cards
          OR responsible_user_id = current_system_user_id()  -- Cards assigned to current user
        )
      )
    )
  )
);

-- Users can only create/update cards where they are the responsible or it's unassigned
CREATE POLICY "Users can create/update pipeline cards based on responsibility"
ON public.pipeline_cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
      OR (
        is_workspace_member(p.workspace_id, 'user'::system_profile)
        AND (
          responsible_user_id IS NULL  -- Can create unassigned cards
          OR responsible_user_id = current_system_user_id()  -- Can create cards assigned to themselves
        )
      )
    )
  )
);

CREATE POLICY "Users can update pipeline cards based on responsibility"
ON public.pipeline_cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
      OR (
        is_workspace_member(p.workspace_id, 'user'::system_profile)
        AND (
          responsible_user_id IS NULL  -- Can update unassigned cards
          OR responsible_user_id = current_system_user_id()  -- Can update their own cards
        )
      )
    )
  )
);