-- Criar política mais permissiva para a organização padrão
CREATE POLICY "Allow insert for default org" 
ON public.clientes 
FOR INSERT 
WITH CHECK (org_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Criar política para select na organização padrão
CREATE POLICY "Allow select for default org"
ON public.clientes 
FOR SELECT 
USING (org_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Criar política para update na organização padrão
CREATE POLICY "Allow update for default org"
ON public.clientes 
FOR UPDATE 
USING (org_id = '00000000-0000-0000-0000-000000000000'::uuid);

-- Criar política para delete na organização padrão
CREATE POLICY "Allow delete for default org"
ON public.clientes 
FOR DELETE 
USING (org_id = '00000000-0000-0000-0000-000000000000'::uuid);