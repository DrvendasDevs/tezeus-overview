-- Enable RLS on contact_tags table
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

-- Add policies for contact_tags
CREATE POLICY "Users can manage contact tags in their workspace"
ON public.contact_tags
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
    AND is_workspace_member(c.workspace_id, 'user'::system_profile)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_tags.contact_id
    AND is_workspace_member(c.workspace_id, 'user'::system_profile)
  )
);