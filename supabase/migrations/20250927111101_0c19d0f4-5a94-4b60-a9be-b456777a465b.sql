-- Criar tabela de cargos
CREATE TABLE public.cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  funcao TEXT,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (policies permissivas para desenvolvimento)
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

-- Policy permissiva para desenvolvimento
CREATE POLICY "Allow all operations on cargos" 
ON public.cargos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Criar trigger para updated_at
CREATE TRIGGER update_cargos_updated_at
BEFORE UPDATE ON public.cargos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();