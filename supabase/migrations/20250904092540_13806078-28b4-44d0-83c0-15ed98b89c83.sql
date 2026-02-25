-- Create secure table for Evolution API tokens
CREATE TABLE public.evolution_instance_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  instance_name TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, instance_name)
);

-- Enable RLS - only service role can access tokens for security
ALTER TABLE public.evolution_instance_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow only service role access (for edge functions)
CREATE POLICY "Service role can manage evolution_instance_tokens" 
ON public.evolution_instance_tokens 
FOR ALL 
USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text))
WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));

-- Add trigger for updated_at
CREATE TRIGGER update_evolution_instance_tokens_updated_at
BEFORE UPDATE ON public.evolution_instance_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();