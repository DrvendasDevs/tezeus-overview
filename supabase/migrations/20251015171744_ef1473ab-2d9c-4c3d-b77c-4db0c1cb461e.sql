-- Add queue_id column to connections table
ALTER TABLE public.connections 
ADD COLUMN queue_id uuid REFERENCES public.queues(id) ON DELETE SET NULL;