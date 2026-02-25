-- Add CRM configuration columns to connections table
ALTER TABLE public.connections 
ADD COLUMN auto_create_crm_card boolean DEFAULT false,
ADD COLUMN default_pipeline_id uuid REFERENCES public.pipelines(id);

-- Add index for better performance on pipeline lookups
CREATE INDEX idx_connections_default_pipeline_id ON public.connections(default_pipeline_id);

-- Add comment to document the new columns
COMMENT ON COLUMN public.connections.auto_create_crm_card IS 'Whether to automatically create CRM cards for new conversations on this connection';
COMMENT ON COLUMN public.connections.default_pipeline_id IS 'Default pipeline to create CRM cards in for this connection';