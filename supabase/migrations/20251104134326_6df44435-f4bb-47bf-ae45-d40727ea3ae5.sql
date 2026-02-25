
-- Verificar e recriar as políticas com permissões corretas para o role anon
-- Primeiro, garantir que RLS está habilitado
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Dropar políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "contacts_select_all" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_all" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_all" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_all" ON public.contacts;

-- Criar novas políticas que permitam acesso completo via anon e authenticated
CREATE POLICY "contacts_public_select"
ON public.contacts
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "contacts_public_insert"
ON public.contacts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "contacts_public_update"
ON public.contacts
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "contacts_public_delete"
ON public.contacts
FOR DELETE
TO anon, authenticated
USING (true);

-- Comentário explicativo
COMMENT ON TABLE public.contacts IS 'Tabela de contatos com acesso público controlado pela aplicação via workspace_id';
