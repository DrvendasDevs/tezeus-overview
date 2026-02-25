-- Create system_customization table for global system theming
CREATE TABLE public.system_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logo_url TEXT,
  background_color TEXT DEFAULT 'hsl(240, 10%, 3.9%)',
  primary_color TEXT DEFAULT 'hsl(47.9, 95.8%, 53.1%)',
  header_color TEXT DEFAULT 'hsl(240, 5.9%, 10%)',
  sidebar_color TEXT DEFAULT 'hsl(240, 5.9%, 10%)',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.system_customization ENABLE ROW LEVEL SECURITY;

-- Create policies for system_customization
CREATE POLICY "Masters can view system customization" 
ON public.system_customization 
FOR SELECT 
USING (is_current_user_master());

CREATE POLICY "Masters can update system customization" 
ON public.system_customization 
FOR UPDATE 
USING (is_current_user_master());

CREATE POLICY "Masters can insert system customization" 
ON public.system_customization 
FOR INSERT 
WITH CHECK (is_current_user_master());

CREATE POLICY "Masters can delete system customization" 
ON public.system_customization 
FOR DELETE 
USING (is_current_user_master());

-- Insert default configuration
INSERT INTO public.system_customization (
  background_color,
  primary_color,
  header_color,
  sidebar_color
) VALUES (
  'hsl(240, 10%, 3.9%)',
  'hsl(47.9, 95.8%, 53.1%)',
  'hsl(240, 5.9%, 10%)',
  'hsl(240, 5.9%, 10%)'
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_system_customization_updated_at
BEFORE UPDATE ON public.system_customization
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();