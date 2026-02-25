-- Corrigir workspace_id da fila "teste" para o workspace "Dr Vendas"
UPDATE queues 
SET workspace_id = 'afc5af73-0979-4bbc-9101-c505210ad4f3',
    updated_at = NOW()
WHERE id = '98b4ea6a-79aa-4893-8814-f9610049f3ea';