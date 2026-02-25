-- Criar uma VIEW para buscar estatísticas consolidadas das workspaces (CORRIGIDO)
CREATE OR REPLACE VIEW v_workspace_stats AS
SELECT 
    w.id AS workspace_id,
    (SELECT COUNT(*) FROM connections c WHERE c.workspace_id = w.id) as connections_count,
    (SELECT COUNT(*) FROM pipeline_cards pc JOIN pipelines p ON pc.pipeline_id = p.id WHERE p.workspace_id = w.id) as deals_count
FROM workspaces w;

-- Garantir permissões de leitura
GRANT SELECT ON v_workspace_stats TO authenticated;
GRANT SELECT ON v_workspace_stats TO service_role;

