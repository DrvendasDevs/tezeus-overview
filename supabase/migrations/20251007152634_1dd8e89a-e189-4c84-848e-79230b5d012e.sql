-- Remover políticas RLS do bucket activity-attachments
DROP POLICY IF EXISTS "Usuários podem visualizar anexos de atividades do seu workspace" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de anexos para atividades do seu workspace" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar anexos de atividades do seu workspace" ON storage.objects;