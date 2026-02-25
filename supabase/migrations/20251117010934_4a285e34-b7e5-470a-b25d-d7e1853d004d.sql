-- Função para mover card que dispara eventos Realtime
CREATE OR REPLACE FUNCTION public.move_pipeline_card(
  p_card_id uuid,
  p_new_column_id uuid
)
RETURNS TABLE(
  id uuid,
  pipeline_id uuid,
  column_id uuid,
  contact_id uuid,
  title text,
  updated_at timestamptz,
  moved_to_column_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar o card
  UPDATE pipeline_cards
  SET 
    column_id = p_new_column_id,
    moved_to_column_at = NOW(),
    updated_at = NOW()
  WHERE pipeline_cards.id = p_card_id;
  
  -- Retornar o card atualizado para disparar eventos Realtime
  RETURN QUERY
  SELECT 
    pc.id,
    pc.pipeline_id,
    pc.column_id,
    pc.contact_id,
    pc.title,
    pc.updated_at,
    pc.moved_to_column_at
  FROM pipeline_cards pc
  WHERE pc.id = p_card_id;
END;
$$;