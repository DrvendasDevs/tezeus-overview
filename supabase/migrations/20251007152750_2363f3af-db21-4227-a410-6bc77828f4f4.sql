-- Criar políticas permissivas para o bucket activity-attachments
CREATE POLICY "Permitir todos os uploads para activity-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'activity-attachments');

CREATE POLICY "Permitir todos os selects para activity-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'activity-attachments');

CREATE POLICY "Permitir todos os updates para activity-attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'activity-attachments');

CREATE POLICY "Permitir todos os deletes para activity-attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'activity-attachments');