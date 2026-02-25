-- Criar bucket para avatares de usuários se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Política para permitir que usuários façam upload de seus próprios avatares
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars'
);

-- Política para permitir que usuários atualizem seus próprios avatares  
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'user-avatars'
);

-- Política para permitir leitura pública dos avatares
CREATE POLICY "Public avatar access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-avatars');

-- Política para permitir que usuários deletem seus próprios avatares
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'user-avatars'
);

-- Garantir que a tabela system_users permite atualização do campo avatar
-- RLS já está habilitado, apenas garantir que existe política de atualização
DO $$
BEGIN
  -- Remover política se existir
  DROP POLICY IF EXISTS "Users can update their own avatar field" ON public.system_users;
  
  -- Criar nova política
  CREATE POLICY "Users can update their own avatar field"
  ON public.system_users
  FOR UPDATE
  USING (id = current_system_user_id())
  WITH CHECK (id = current_system_user_id());
END $$;