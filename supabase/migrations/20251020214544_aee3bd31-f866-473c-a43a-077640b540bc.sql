-- Criar tabela para armazenar os campos obrigatórios do workspace
CREATE TABLE public.workspace_contact_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, field_name)
);

-- Habilitar RLS
ALTER TABLE public.workspace_contact_fields ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (simplificado)
CREATE POLICY "Allow all operations on workspace_contact_fields"
ON public.workspace_contact_fields 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Índice para performance
CREATE INDEX idx_workspace_contact_fields_workspace ON public.workspace_contact_fields(workspace_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_workspace_contact_fields_updated_at
BEFORE UPDATE ON public.workspace_contact_fields
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();