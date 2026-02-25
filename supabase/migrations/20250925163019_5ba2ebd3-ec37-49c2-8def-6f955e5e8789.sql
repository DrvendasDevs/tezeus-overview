-- Create contact_observations table
CREATE TABLE public.contact_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_observations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view observations in their workspace"
ON public.contact_observations
FOR SELECT
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can create observations in their workspace"
ON public.contact_observations
FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can update observations in their workspace"
ON public.contact_observations
FOR UPDATE
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can delete observations in their workspace"
ON public.contact_observations
FOR DELETE
USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Add trigger for updated_at
CREATE TRIGGER update_contact_observations_updated_at
BEFORE UPDATE ON public.contact_observations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();