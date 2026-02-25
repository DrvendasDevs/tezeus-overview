-- Add profile image columns to contacts table
ALTER TABLE public.contacts 
ADD COLUMN profile_image_url TEXT,
ADD COLUMN profile_image_updated_at TIMESTAMP WITH TIME ZONE;