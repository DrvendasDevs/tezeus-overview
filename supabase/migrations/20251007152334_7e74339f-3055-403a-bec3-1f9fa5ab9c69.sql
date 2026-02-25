-- Criar bucket para anexos de atividades
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-attachments', 'activity-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que usuários visualizem anexos de atividades do seu workspace
CREATE POLICY "Usuários podem visualizar anexos de atividades do seu workspace"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'activity-attachments' AND
  EXISTS (
    SELECT 1 FROM activities a
    INNER JOIN workspace_members wm ON wm.workspace_id = a.workspace_id
    WHERE wm.user_id = auth.uid()
    AND (storage.foldername(name))[1] = a.workspace_id::text
  )
);

-- Política para permitir que usuários façam upload de anexos para atividades do seu workspace
CREATE POLICY "Usuários podem fazer upload de anexos para atividades do seu workspace"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'activity-attachments' AND
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id::text = (storage.foldername(name))[1]
    AND user_id = auth.uid()
  )
);

-- Política para permitir que usuários deletem anexos de atividades do seu workspace
CREATE POLICY "Usuários podem deletar anexos de atividades do seu workspace"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'activity-attachments' AND
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id::text = (storage.foldername(name))[1]
    AND user_id = auth.uid()
  )
);