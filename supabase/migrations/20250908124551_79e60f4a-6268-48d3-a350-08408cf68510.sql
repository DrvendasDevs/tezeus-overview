-- Make dashboard cards global by allowing NULL workspace_id
ALTER TABLE public.dashboard_cards ALTER COLUMN workspace_id DROP NOT NULL;

-- Update the SELECT policy to allow viewing global cards (workspace_id IS NULL) or workspace member cards
DROP POLICY IF EXISTS "dashboard_cards_select" ON public.dashboard_cards;

CREATE POLICY "dashboard_cards_select_global_and_workspace" 
ON public.dashboard_cards 
FOR SELECT 
USING (
  workspace_id IS NULL OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);