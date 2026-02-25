-- Adicionar uma tag de teste ao contato para demonstrar funcionamento
INSERT INTO contact_tags (contact_id, tag_id) 
SELECT 'c1cd86b9-4c0c-422a-bd03-d2e4791a7b96', '09386b50-4178-4970-a3c0-fb8e313e2744'
WHERE NOT EXISTS (
  SELECT 1 FROM contact_tags 
  WHERE contact_id = 'c1cd86b9-4c0c-422a-bd03-d2e4791a7b96' 
  AND tag_id = '09386b50-4178-4970-a3c0-fb8e313e2744'
);