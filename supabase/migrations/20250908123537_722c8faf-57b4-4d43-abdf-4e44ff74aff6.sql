-- Update RLS policies for dashboard_cards table to restrict CRUD operations to master users only

-- Drop existing policies
DROP POLICY IF EXISTS "dashboard_cards_insert" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_update" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_delete" ON public.dashboard_cards;

-- Create new policies that only allow master users to create, update, and delete
CREATE POLICY "dashboard_cards_insert_master_only" 
ON public.dashboard_cards 
FOR INSERT 
WITH CHECK (is_current_user_master());

CREATE POLICY "dashboard_cards_update_master_only" 
ON public.dashboard_cards 
FOR UPDATE 
USING (is_current_user_master());

CREATE POLICY "dashboard_cards_delete_master_only" 
ON public.dashboard_cards 
FOR DELETE 
USING (is_current_user_master());

-- Keep the existing SELECT policy for workspace members (unchanged)
-- This allows all workspace members to view the cards