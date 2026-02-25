-- Tornar o bucket agent-knowledge público para permitir acesso direto aos arquivos
UPDATE storage.buckets 
SET public = true 
WHERE id = 'agent-knowledge';