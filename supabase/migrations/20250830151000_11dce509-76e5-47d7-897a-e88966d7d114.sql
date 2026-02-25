-- Create channels table for WhatsApp instances
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  instance TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  last_state_at TIMESTAMPTZ,
  webhook_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on channels table
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
CREATE POLICY "Allow authenticated users to read channels" 
ON public.channels FOR SELECT 
USING (true);

CREATE POLICY "Allow service role to manage channels" 
ON public.channels FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION public.update_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.update_channels_updated_at();

-- Create view for listing channels in UI
CREATE OR REPLACE VIEW public.channels_view AS
SELECT 
  id,
  name,
  number,
  instance,
  status,
  last_state_at,
  created_at,
  updated_at
FROM public.channels
ORDER BY created_at DESC;