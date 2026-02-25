-- Fix security issues from the linter

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.channels_view;

CREATE VIEW public.channels_view AS
SELECT 
  id,
  name,
  number,
  instance,
  status,
  last_state_at,
  created_at,
  updated_at
FROM public.channels
ORDER BY created_at DESC;

-- Fix the function search path issue
CREATE OR REPLACE FUNCTION public.update_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;