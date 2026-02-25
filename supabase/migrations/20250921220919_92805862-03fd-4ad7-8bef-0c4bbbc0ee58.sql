-- First check and update existing policies for pipelines
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admins can manage pipelines in their workspace" ON pipelines;
  DROP POLICY IF EXISTS "Masters and admins can manage pipelines in their workspace" ON pipelines;
  DROP POLICY IF EXISTS "Users can view pipelines in their workspace" ON pipelines;
  
  -- Create new policies
  CREATE POLICY "Masters and admins can manage pipelines in their workspace" 
  ON pipelines 
  FOR ALL 
  USING (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile));

  CREATE POLICY "Users can view pipelines in their workspace" 
  ON pipelines 
  FOR SELECT 
  USING (is_current_user_master() OR is_workspace_member(workspace_id, 'user'::system_profile));
END
$$;

-- Update policies for pipeline_columns
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admins can manage pipeline columns in their workspace" ON pipeline_columns;
  DROP POLICY IF EXISTS "Masters and admins can manage pipeline columns in their workspace" ON pipeline_columns;
  DROP POLICY IF EXISTS "Users can view pipeline columns in their workspace" ON pipeline_columns;
  
  -- Create new policies
  CREATE POLICY "Masters and admins can manage pipeline columns in their workspace" 
  ON pipeline_columns 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  ));

  CREATE POLICY "Users can view pipeline columns in their workspace" 
  ON pipeline_columns 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'user'::system_profile))
  ));
END
$$;

-- Update policies for pipeline_cards
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admins can manage pipeline cards in their workspace" ON pipeline_cards;
  DROP POLICY IF EXISTS "Masters and admins can manage pipeline cards in their workspace" ON pipeline_cards;
  DROP POLICY IF EXISTS "Users can view pipeline cards in their workspace" ON pipeline_cards;
  
  -- Create new policies
  CREATE POLICY "Masters and admins can manage pipeline cards in their workspace" 
  ON pipeline_cards 
  FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
  ));

  CREATE POLICY "Users can view pipeline cards in their workspace" 
  ON pipeline_cards 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_cards.pipeline_id 
    AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'user'::system_profile))
  ));
END
$$;