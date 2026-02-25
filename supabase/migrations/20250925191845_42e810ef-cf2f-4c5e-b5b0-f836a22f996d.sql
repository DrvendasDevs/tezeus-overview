-- Remover as políticas existentes
DROP POLICY IF EXISTS "Users can view products in their workspace" ON public.products;
DROP POLICY IF EXISTS "Users can create products in their workspace" ON public.products;
DROP POLICY IF EXISTS "Users can update products in their workspace" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in their workspace" ON public.products;

-- Criar políticas mais permissivas temporariamente para debug
CREATE POLICY "Allow all operations on products" 
ON public.products 
FOR ALL 
USING (true)
WITH CHECK (true);