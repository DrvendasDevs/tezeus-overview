-- Add phone column to system_users table
ALTER TABLE public.system_users 
ADD COLUMN phone text;