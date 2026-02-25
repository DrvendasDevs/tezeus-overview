-- Add view_all_deals_permissions to pipeline_columns
ALTER TABLE pipeline_columns 
ADD COLUMN view_all_deals_permissions jsonb DEFAULT '[]'::jsonb;

-- Drop old policy and create new one with view_all_deals support
DROP POLICY IF EXISTS "Users can view pipeline cards based on responsibility_v3" ON pipeline_cards;

CREATE POLICY "Users can view pipeline cards based on responsibility_v4"
ON pipeline_cards FOR SELECT
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
          -- User is responsible for the card
          (pipeline_cards.responsible_user_id = current_system_user_id() AND pipeline_cards.responsible_user_id IS NOT NULL)
          OR
          -- User has permission to view all deals in this column
          (
            EXISTS (
              SELECT 1 FROM pipeline_columns pc
              WHERE pc.id = pipeline_cards.column_id
              AND pc.view_all_deals_permissions @> jsonb_build_array(current_system_user_id()::text)
            )
          )
        )
      )
    )
  )
);