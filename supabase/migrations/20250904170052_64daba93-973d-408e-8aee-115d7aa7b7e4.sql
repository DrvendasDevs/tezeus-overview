-- Add unique constraints to prevent cross-organization connection issues

-- Add unique constraint for channels (org_id, instance)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'channels_org_id_instance_unique'
    ) THEN
        ALTER TABLE public.channels 
        ADD CONSTRAINT channels_org_id_instance_unique 
        UNIQUE (org_id, instance);
    END IF;
END $$;

-- Add unique constraint for evolution_instance_tokens (org_id, instance_name)  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'evolution_instance_tokens_org_id_instance_name_unique'
    ) THEN
        ALTER TABLE public.evolution_instance_tokens 
        ADD CONSTRAINT evolution_instance_tokens_org_id_instance_name_unique 
        UNIQUE (org_id, instance_name);
    END IF;
END $$;

-- Create indexes for better performance on org_id lookups
CREATE INDEX IF NOT EXISTS idx_channels_org_id_instance ON public.channels(org_id, instance);
CREATE INDEX IF NOT EXISTS idx_evolution_instance_tokens_org_id_instance_name ON public.evolution_instance_tokens(org_id, instance_name);