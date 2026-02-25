-- Criar tabela para informações extras dos contatos
CREATE TABLE public.contact_extra_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, field_name)
);

-- Habilitar RLS
ALTER TABLE public.contact_extra_info ENABLE ROW LEVEL SECURITY;

-- Política: permitir todas operações para membros do workspace
CREATE POLICY "Allow all operations on contact_extra_info"
ON public.contact_extra_info
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contact_extra_info_updated_at
BEFORE UPDATE ON public.contact_extra_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhor performance
CREATE INDEX idx_contact_extra_info_contact_id ON public.contact_extra_info(contact_id);
CREATE INDEX idx_contact_extra_info_workspace_id ON public.contact_extra_info(workspace_id);