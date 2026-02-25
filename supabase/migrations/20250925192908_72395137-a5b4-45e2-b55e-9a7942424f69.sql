-- Add additional columns to queues table for better queue management
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#8B5CF6';
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS order_position INTEGER DEFAULT 0;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS distribution_type TEXT DEFAULT 'aleatoria';
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS ai_agent_id UUID REFERENCES public.ai_agents(id);
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS greeting_message TEXT;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_queues_workspace_id ON public.queues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queues_ai_agent_id ON public.queues(ai_agent_id);

-- Update RLS policies for queues
DROP POLICY IF EXISTS "Allow all operations on queues" ON public.queues;

-- Create workspace-based RLS policies for queues
CREATE POLICY "Users can view queues in their workspace" 
ON public.queues 
FOR SELECT 
USING (workspace_id IS NULL OR is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Admins can manage queues in their workspace" 
ON public.queues 
FOR ALL 
USING (workspace_id IS NULL OR is_workspace_member(workspace_id, 'admin'::system_profile))
WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id, 'admin'::system_profile));