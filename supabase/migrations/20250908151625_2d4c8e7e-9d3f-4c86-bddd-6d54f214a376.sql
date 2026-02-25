-- Update RLS policies to allow admin users in addition to master users
DROP POLICY IF EXISTS "dashboard_cards_insert_master" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_update_master" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_delete_master" ON public.dashboard_cards;

-- Create new policies that allow both master and admin users
CREATE POLICY "dashboard_cards_insert_admin" 
ON public.dashboard_cards 
FOR INSERT 
WITH CHECK (is_current_user_master() OR is_current_user_admin());

CREATE POLICY "dashboard_cards_update_admin" 
ON public.dashboard_cards 
FOR UPDATE 
USING (is_current_user_master() OR is_current_user_admin());

CREATE POLICY "dashboard_cards_delete_admin" 
ON public.dashboard_cards 
FOR DELETE 
USING (is_current_user_master() OR is_current_user_admin());