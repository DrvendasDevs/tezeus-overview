-- Criar tabela de produtos comerciais
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para produtos
CREATE POLICY "Users can view products in their workspace" 
ON public.products 
FOR SELECT 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can create products in their workspace" 
ON public.products 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can update products in their workspace" 
ON public.products 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can delete products in their workspace" 
ON public.products 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();