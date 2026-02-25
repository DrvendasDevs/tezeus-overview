-- =============================================
-- Migração: Criar RPC para busca de cards do pipeline
-- =============================================
-- Objetivo: Permitir busca de oportunidades em toda a base de dados,
-- não apenas nos cards já carregados no frontend.

CREATE OR REPLACE FUNCTION public.search_pipeline_cards(
  p_pipeline_id UUID,
  p_search_term TEXT,
  p_limit INT DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_search_pattern TEXT;
BEGIN
  -- Preparar padrão de busca (case-insensitive)
  v_search_pattern := '%' || LOWER(COALESCE(p_search_term, '')) || '%';
  
  -- Se o termo de busca estiver vazio, retornar vazio
  IF p_search_term IS NULL OR TRIM(p_search_term) = '' THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.relevance DESC, t.updated_at DESC), '[]'::json)
  INTO v_result
  FROM (
    SELECT 
      pc.id,
      pc.description,
      pc.description as title, -- Alias para compatibilidade com frontend
      pc.value,
      pc.status,
      pc.qualification,
      pc.pipeline_id,
      pc.column_id,
      pc.contact_id,
      pc.responsible_user_id,
      pc.created_at,
      pc.updated_at,
      col.name as column_name,
      c.name as contact_name,
      c.phone as contact_phone,
      c.email as contact_email,
      c.profile_image_url as contact_image,
      -- Calcular relevância para ordenação
      CASE 
        WHEN LOWER(COALESCE(c.name, '')) LIKE v_search_pattern THEN 3
        WHEN LOWER(COALESCE(c.phone, '')) LIKE v_search_pattern THEN 2
        WHEN LOWER(COALESCE(pc.description, '')) LIKE v_search_pattern THEN 2
        ELSE 1
      END as relevance
    FROM pipeline_cards pc
    LEFT JOIN contacts c ON c.id = pc.contact_id
    LEFT JOIN pipeline_columns col ON col.id = pc.column_id
    WHERE pc.pipeline_id = p_pipeline_id
      AND (pc.is_lab_test IS NOT TRUE)
      AND (
        LOWER(COALESCE(pc.description, '')) LIKE v_search_pattern
        OR LOWER(COALESCE(c.name, '')) LIKE v_search_pattern
        OR LOWER(COALESCE(c.phone, '')) LIKE v_search_pattern
        OR LOWER(COALESCE(c.email, '')) LIKE v_search_pattern
      )
    LIMIT p_limit
  ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.search_pipeline_cards IS 'RPC para buscar cards do pipeline por termo de busca em toda a base de dados';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.search_pipeline_cards TO authenticated;

-- Criar índices para otimizar a busca (se não existirem)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_description_lower ON pipeline_cards(LOWER(description));
CREATE INDEX IF NOT EXISTS idx_contacts_name_lower ON contacts(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_contacts_phone_lower ON contacts(LOWER(phone));
