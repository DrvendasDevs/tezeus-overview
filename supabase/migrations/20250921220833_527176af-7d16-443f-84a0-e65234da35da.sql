-- Update RLS policies for pipelines to allow master users
DROP POLICY IF EXISTS "Admins can manage pipelines in their workspace" ON pipelines;
DROP POLICY IF EXISTS "Users can view pipelines in their workspace" ON pipelines;

CREATE POLICY "Masters and admins can manage pipelines in their workspace" 
ON pipelines 
FOR ALL 
USING (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile))
WITH CHECK (is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "Users can view pipelines in their workspace" 
ON pipelines 
FOR SELECT 
USING (is_current_user_master() OR is_workspace_member(workspace_id, 'user'::system_profile));

-- Update RLS policies for pipeline_columns to allow master users
DROP POLICY IF EXISTS "Admins can manage pipeline columns in their workspace" ON pipeline_columns;
DROP POLICY IF EXISTS "Users can view pipeline columns in their workspace" ON pipeline_columns;

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

-- Update RLS policies for pipeline_cards to allow master users
DROP POLICY IF EXISTS "Admins can manage pipeline cards in their workspace" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can view pipeline cards in their workspace" ON pipeline_cards;

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