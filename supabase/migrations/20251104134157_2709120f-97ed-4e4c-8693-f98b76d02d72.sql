
-- Remover políticas antigas que dependem de auth.uid()
DROP POLICY IF EXISTS "contacts_select_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_by_workspace" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_by_admin" ON public.contacts;

-- Criar novas políticas que permitem acesso via service role
-- O controle de acesso será feito pela aplicação via headers x-workspace-id
CREATE POLICY "contacts_select_all"
ON public.contacts
FOR SELECT
TO public
USING (true);

CREATE POLICY "contacts_insert_all"
ON public.contacts
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "contacts_update_all"
ON public.contacts
FOR UPDATE
TO public
USING (true);

CREATE POLICY "contacts_delete_all"
ON public.contacts
FOR DELETE
TO public
USING (true);

-- Adicionar comentário explicativo
COMMENT ON TABLE public.contacts IS 'Tabela de contatos. Controle de acesso feito pela aplicação via x-workspace-id header.';
