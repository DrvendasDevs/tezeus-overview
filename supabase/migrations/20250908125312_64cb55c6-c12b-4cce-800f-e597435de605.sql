-- Temporarily allow all authenticated users to create dashboard cards for testing
-- This allows testing while the user authentication system is being set up properly

DROP POLICY IF EXISTS "dashboard_cards_insert_master_only" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_update_master_only" ON public.dashboard_cards;  
DROP POLICY IF EXISTS "dashboard_cards_delete_master_only" ON public.dashboard_cards;

-- Create temporary policies that allow authenticated users to manage cards
CREATE POLICY "dashboard_cards_insert_authenticated" 
ON public.dashboard_cards 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "dashboard_cards_update_authenticated" 
ON public.dashboard_cards 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "dashboard_cards_delete_authenticated" 
ON public.dashboard_cards 
FOR DELETE 
USING (auth.uid() IS NOT NULL);