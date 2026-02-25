-- Add caption column to quick_media table
ALTER TABLE public.quick_media ADD COLUMN IF NOT EXISTS caption TEXT;

-- Add caption column to quick_documents table
ALTER TABLE public.quick_documents ADD COLUMN IF NOT EXISTS caption TEXT;