-- Remove default hardcoded URL from connection_secrets table as well
-- This ensures all URLs must be explicitly configured via admin panel

ALTER TABLE public.connection_secrets 
ALTER COLUMN evolution_url DROP DEFAULT;

-- Add comment explaining this must be configured dynamically
COMMENT ON COLUMN public.connection_secrets.evolution_url IS 
  'Evolution API URL configured dynamically - no default value, must match workspace config';