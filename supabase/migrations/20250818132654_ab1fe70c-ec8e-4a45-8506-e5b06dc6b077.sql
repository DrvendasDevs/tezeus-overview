-- Add extra_info column to contacts table to store additional information
ALTER TABLE public.contacts 
ADD COLUMN extra_info JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.extra_info IS 'Stores additional custom fields as JSON';