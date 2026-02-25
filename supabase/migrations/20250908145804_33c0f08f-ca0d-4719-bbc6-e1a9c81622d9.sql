-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Anyone can view global dashboard cards" ON public.dashboard_cards;
DROP POLICY IF EXISTS "Master users can manage dashboard cards" ON public.dashboard_cards;

-- Create proper policies
CREATE POLICY "dashboard_cards_select_global" 
ON public.dashboard_cards 
FOR SELECT 
USING (workspace_id IS NULL OR workspace_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "dashboard_cards_insert_master" 
ON public.dashboard_cards 
FOR INSERT 
WITH CHECK (is_current_user_master());

CREATE POLICY "dashboard_cards_update_master" 
ON public.dashboard_cards 
FOR UPDATE 
USING (is_current_user_master());

CREATE POLICY "dashboard_cards_delete_master" 
ON public.dashboard_cards 
FOR DELETE 
USING (is_current_user_master());