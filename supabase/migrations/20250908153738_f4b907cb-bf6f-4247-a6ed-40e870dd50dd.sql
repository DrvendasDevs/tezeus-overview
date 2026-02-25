-- Drop existing restrictive policies
DROP POLICY IF EXISTS "dashboard_cards_select_global" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_insert_admin" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_update_admin" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_delete_admin" ON public.dashboard_cards;

-- Create permissive policies that allow all operations
CREATE POLICY "dashboard_cards_select_all" 
ON public.dashboard_cards 
FOR SELECT 
USING (true);

CREATE POLICY "dashboard_cards_insert_all" 
ON public.dashboard_cards 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "dashboard_cards_update_all" 
ON public.dashboard_cards 
FOR UPDATE 
USING (true);

CREATE POLICY "dashboard_cards_delete_all" 
ON public.dashboard_cards 
FOR DELETE 
USING (true);