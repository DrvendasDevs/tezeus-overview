-- Add favicon_url column to system_customization table
ALTER TABLE public.system_customization 
ADD COLUMN IF NOT EXISTS favicon_url TEXT;