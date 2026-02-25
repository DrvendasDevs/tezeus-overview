-- Remove default hardcoded URL from evolution_instance_tokens
-- This forces all future configurations to be set explicitly via admin panel
-- Existing records remain unchanged

ALTER TABLE public.evolution_instance_tokens 
ALTER COLUMN evolution_url DROP DEFAULT;

-- Add comment explaining this must be configured dynamically
COMMENT ON COLUMN public.evolution_instance_tokens.evolution_url IS 
  'Evolution API URL configured via admin-master panel - no default value, must be set explicitly';