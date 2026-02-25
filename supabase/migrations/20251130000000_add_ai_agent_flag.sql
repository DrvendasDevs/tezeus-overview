-- Add is_ai_agent column to quick_messages table
ALTER TABLE public.quick_messages 
ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;

-- Add is_ai_agent column to quick_audios table
ALTER TABLE public.quick_audios 
ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;

-- Add is_ai_agent column to quick_media table
ALTER TABLE public.quick_media 
ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;

-- Add is_ai_agent column to quick_documents table
ALTER TABLE public.quick_documents 
ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;

-- Add is_ai_agent column to quick_funnels table
-- Note: Check if table exists first as it might not be in all migrations
DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'quick_funnels') THEN
        ALTER TABLE public.quick_funnels 
        ADD COLUMN IF NOT EXISTS is_ai_agent BOOLEAN DEFAULT false;
    END IF;
END $$;





