-- Workspace Database Restructuring Migration
-- This migration standardizes the database to use "Workspace" as the canonical entity

BEGIN;

-- Log start of migration
INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
VALUES (gen_random_uuid(), 'info', 'migration', 'Starting workspace restructuring migration', '{"migration": "workspace_restructuring"}');

-- 1. Create workspaces table from orgs (if orgs exists)
DO $$
BEGIN
  -- Check if orgs table exists and workspaces doesn't
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orgs' AND table_schema = 'public') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    
    -- Rename orgs to workspaces
    ALTER TABLE public.orgs RENAME TO workspaces;
    
    -- Update constraint names
    ALTER TABLE public.workspaces RENAME CONSTRAINT orgs_pkey TO workspaces_pkey;
    
    -- Log the rename
    INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
    VALUES (gen_random_uuid(), 'info', 'migration', 'Renamed orgs table to workspaces', '{}');
    
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    
    -- Create workspaces table if neither exists
    CREATE TABLE public.workspaces (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      name text NOT NULL,
      cnpj text,
      slug text
    );
    
    -- Enable RLS
    ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
    
    -- Add trigger for updated_at
    CREATE TRIGGER update_workspaces_updated_at
      BEFORE UPDATE ON public.workspaces
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
      
    -- Add trigger for slug generation
    CREATE TRIGGER set_workspace_slug
      BEFORE INSERT OR UPDATE ON public.workspaces
      FOR EACH ROW
      EXECUTE FUNCTION public.set_org_slug();
    
    -- Log the creation
    INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
    VALUES (gen_random_uuid(), 'info', 'migration', 'Created workspaces table', '{}');
    
  END IF;
END $$;

-- 2. Handle workspace_members (migrate from org_members if needed)
DO $$
BEGIN
  -- Check if org_members exists and has data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'org_members' AND table_schema = 'public') THEN
    
    -- Migrate data from org_members to workspace_members if workspace_members is empty
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members LIMIT 1) THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at)
      SELECT 
        org_id as workspace_id,
        user_id,
        CASE 
          WHEN om.role = 'OWNER' THEN 'mentor_master'::workspace_role
          WHEN om.role = 'ADMIN' THEN 'gestor'::workspace_role
          ELSE 'colaborador'::workspace_role
        END as role,
        om.created_at
      FROM public.org_members om
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
      
      -- Log migration
      INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
      VALUES (gen_random_uuid(), 'info', 'migration', 'Migrated org_members to workspace_members', '{}');
    END IF;
    
  END IF;
END $$;

-- 3. Fix activities table - remove org_id default and add workspace_id if needed
DO $$
BEGIN
  -- Check if activities has org_id column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'org_id' AND table_schema = 'public') THEN
    
    -- Remove default value
    ALTER TABLE public.activities ALTER COLUMN org_id DROP DEFAULT;
    
    -- Rename org_id to workspace_id if workspace_id doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'workspace_id' AND table_schema = 'public') THEN
      ALTER TABLE public.activities RENAME COLUMN org_id TO workspace_id;
    END IF;
    
    -- Update any zero UUIDs to the first available workspace
    UPDATE public.activities 
    SET workspace_id = (SELECT id FROM public.workspaces LIMIT 1)
    WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;
    
    -- Make NOT NULL if possible
    IF NOT EXISTS (SELECT 1 FROM public.activities WHERE workspace_id IS NULL) THEN
      ALTER TABLE public.activities ALTER COLUMN workspace_id SET NOT NULL;
    END IF;
    
  END IF;
END $$;

-- 4. Fix evolution_instance_tokens - remove workspace_id default
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evolution_instance_tokens' AND column_name = 'workspace_id' AND table_schema = 'public') THEN
    
    -- Remove default value
    ALTER TABLE public.evolution_instance_tokens ALTER COLUMN workspace_id DROP DEFAULT;
    
    -- Update any zero UUIDs to the first available workspace
    UPDATE public.evolution_instance_tokens 
    SET workspace_id = (SELECT id FROM public.workspaces LIMIT 1)
    WHERE workspace_id = '00000000-0000-0000-0000-000000000000'::uuid;
    
    -- Make NOT NULL if possible
    IF NOT EXISTS (SELECT 1 FROM public.evolution_instance_tokens WHERE workspace_id IS NULL) THEN
      ALTER TABLE public.evolution_instance_tokens ALTER COLUMN workspace_id SET NOT NULL;
    END IF;
    
  END IF;
END $$;

-- 5. Clean up duplicate foreign keys and fix constraint names
DO $$
BEGIN
  -- Drop duplicate constraints if they exist (ignore errors if they don't exist)
  
  -- Channels
  BEGIN
    ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS fk_channels_org;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Contacts  
  BEGIN
    ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS fk_contacts_org;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Conversations
  BEGIN
    ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS fk_conversations_org;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
END $$;

-- 6. Ensure workspace_id inheritance triggers
CREATE OR REPLACE FUNCTION public.sync_conversation_workspace_from_connection()
RETURNS TRIGGER AS $$
DECLARE
  conn_ws uuid;
BEGIN
  IF NEW.connection_id IS NOT NULL THEN
    SELECT workspace_id INTO conn_ws FROM public.connections WHERE id = NEW.connection_id;
    IF conn_ws IS NOT NULL THEN
      NEW.workspace_id := conn_ws;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_message_workspace()
RETURNS TRIGGER AS $$
DECLARE
  ws uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.conversations WHERE id = NEW.conversation_id;
  IF ws IS NOT NULL THEN
    NEW.workspace_id := ws;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_conversation_workspace_trigger ON public.conversations;
DROP TRIGGER IF EXISTS set_message_workspace_trigger ON public.messages;

-- Create triggers
CREATE TRIGGER sync_conversation_workspace_trigger
  BEFORE INSERT OR UPDATE OF connection_id ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversation_workspace_from_connection();

CREATE TRIGGER set_message_workspace_trigger
  BEFORE INSERT OR UPDATE OF conversation_id ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_workspace();

-- 7. Backfill workspace_id in chain: connections -> conversations -> messages
DO $$
BEGIN
  -- Update conversations from connections
  UPDATE public.conversations cv
  SET workspace_id = c.workspace_id
  FROM public.connections c
  WHERE c.id = cv.connection_id
  AND cv.workspace_id IS DISTINCT FROM c.workspace_id;
  
  -- Update messages from conversations
  UPDATE public.messages m
  SET workspace_id = cv.workspace_id
  FROM public.conversations cv
  WHERE cv.id = m.conversation_id
  AND m.workspace_id IS DISTINCT FROM cv.workspace_id;
  
  -- Log backfill
  INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
  VALUES (gen_random_uuid(), 'info', 'migration', 'Completed workspace_id backfill', '{}');
END $$;

-- 8. Set NOT NULL for workspace_id where appropriate
DO $$
BEGIN
  -- connections
  IF NOT EXISTS (SELECT 1 FROM public.connections WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.connections ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  
  -- conversations
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.conversations ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  
  -- messages
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.messages ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  
  -- tags
  IF NOT EXISTS (SELECT 1 FROM public.tags WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.tags ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END $$;

-- 9. Fix tags uniqueness (remove global unique, add per-workspace unique)
DO $$
BEGIN
  -- Drop global unique constraint on tags.name if it exists
  BEGIN
    ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_name_key;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Add unique constraint per workspace
  BEGIN
    ALTER TABLE public.tags ADD CONSTRAINT tags_workspace_name_unique UNIQUE (workspace_id, name);
  EXCEPTION WHEN duplicate_table THEN NULL;
  END;
END $$;

-- 10. Add ON DELETE RESTRICT to conversations.connection_id
DO $$
BEGIN
  -- First drop existing foreign key if it exists
  BEGIN
    ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_connection_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Add the constraint with ON DELETE RESTRICT
  ALTER TABLE public.conversations 
  ADD CONSTRAINT conversations_connection_id_fkey 
  FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE RESTRICT;
END $$;

-- 11. Create essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_connections_workspace_id ON public.connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON public.tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

-- 12. RLS Policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- Create workspace RLS policies
CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT USING (
    is_current_user_master() OR 
    is_workspace_member(id, 'colaborador'::workspace_role)
  );

CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT WITH CHECK (is_current_user_master());

CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE USING (
    is_current_user_master() OR 
    is_workspace_member(id, 'gestor'::workspace_role)
  );

CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE USING (is_current_user_master());

-- 13. RLS Policies for workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON public.workspace_members;

-- Create workspace_members RLS policies
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    is_current_user_master() OR 
    is_workspace_member(workspace_id, 'gestor'::workspace_role)
  );

CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    is_current_user_master() OR 
    is_workspace_member(workspace_id, 'gestor'::workspace_role)
  );

CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    is_current_user_master() OR 
    is_workspace_member(workspace_id, 'gestor'::workspace_role)
  );

CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE USING (
    is_current_user_master() OR 
    is_workspace_member(workspace_id, 'gestor'::workspace_role)
  );

-- 14. Create or recreate workspaces_view
DROP VIEW IF EXISTS public.workspaces_view;

CREATE VIEW public.workspaces_view AS
SELECT 
  w.id as workspace_id,
  w.name,
  w.cnpj,
  w.slug,
  w.created_at,
  w.updated_at,
  COALESCE(conn_count.connections_count, 0) as connections_count
FROM public.workspaces w
LEFT JOIN (
  SELECT 
    workspace_id,
    COUNT(*) as connections_count
  FROM public.connections
  GROUP BY workspace_id
) conn_count ON w.id = conn_count.workspace_id;

-- Log completion
INSERT INTO provider_logs (correlation_id, level, event_type, message, metadata) 
VALUES (gen_random_uuid(), 'info', 'migration', 'Workspace restructuring migration completed successfully', '{"migration": "workspace_restructuring"}');

COMMIT;