-- Enable RLS on dashboard_cards table and create proper policies
ALTER TABLE public.dashboard_cards ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read global cards (workspace_id IS NULL or '00000000-0000-0000-0000-000000000000')
CREATE POLICY "Anyone can view global dashboard cards" 
ON public.dashboard_cards 
FOR SELECT 
USING (workspace_id IS NULL OR workspace_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Only master users can manage dashboard cards
CREATE POLICY "Master users can manage dashboard cards" 
ON public.dashboard_cards 
FOR ALL 
USING (is_current_user_master())
WITH CHECK (is_current_user_master());