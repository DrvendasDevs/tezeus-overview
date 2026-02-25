-- Create table for organization messaging settings
CREATE TABLE public.org_messaging_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  default_instance TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Enable Row Level Security
ALTER TABLE public.org_messaging_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "org_messaging_settings_select" 
ON public.org_messaging_settings 
FOR SELECT 
USING (is_member(org_id));

CREATE POLICY "org_messaging_settings_insert" 
ON public.org_messaging_settings 
FOR INSERT 
WITH CHECK (is_member(org_id, 'ADMIN'::org_role));

CREATE POLICY "org_messaging_settings_update" 
ON public.org_messaging_settings 
FOR UPDATE 
USING (is_member(org_id, 'ADMIN'::org_role));

CREATE POLICY "org_messaging_settings_delete" 
ON public.org_messaging_settings 
FOR DELETE 
USING (is_member(org_id, 'ADMIN'::org_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_org_messaging_settings_updated_at
BEFORE UPDATE ON public.org_messaging_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();