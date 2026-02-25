-- Update RLS policies for evolution_instance_tokens to allow org members to manage their tokens
DROP POLICY IF EXISTS "Service role can manage evolution_instance_tokens" ON public.evolution_instance_tokens;

-- Allow org members to view their organization's tokens
CREATE POLICY "evolution_instance_tokens_select" 
ON public.evolution_instance_tokens 
FOR SELECT 
USING (is_member(org_id));

-- Allow org members to create tokens for their organization
CREATE POLICY "evolution_instance_tokens_insert" 
ON public.evolution_instance_tokens 
FOR INSERT 
WITH CHECK (is_member(org_id));

-- Allow org members to update their organization's tokens
CREATE POLICY "evolution_instance_tokens_update" 
ON public.evolution_instance_tokens 
FOR UPDATE 
USING (is_member(org_id));

-- Allow org members to delete their organization's tokens
CREATE POLICY "evolution_instance_tokens_delete" 
ON public.evolution_instance_tokens 
FOR DELETE 
USING (is_member(org_id));