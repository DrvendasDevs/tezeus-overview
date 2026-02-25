-- Add connection_limit to org_messaging_settings table
ALTER TABLE public.org_messaging_settings 
ADD COLUMN connection_limit INTEGER DEFAULT 1 NOT NULL;