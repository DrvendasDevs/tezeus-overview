-- Políticas RLS para o bucket agent-knowledge
-- Permitir que usuários autenticados façam upload, visualização, atualização e deleção de arquivos

-- 1. Política para UPLOAD (INSERT)
CREATE POLICY "Authenticated users can upload knowledge files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-knowledge'
);

-- 2. Política para VISUALIZAR/BAIXAR (SELECT)
CREATE POLICY "Authenticated users can view knowledge files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-knowledge'
);

-- 3. Política para ATUALIZAR (UPDATE)
CREATE POLICY "Authenticated users can update knowledge files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agent-knowledge'
)
WITH CHECK (
  bucket_id = 'agent-knowledge'
);

-- 4. Política para DELETAR (DELETE)
CREATE POLICY "Authenticated users can delete knowledge files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'agent-knowledge'
);