-- Fix orphaned cards that have column_id from different pipeline
-- First, update the card that is currently orphaned
UPDATE pipeline_cards pc
SET column_id = (
  SELECT col.id 
  FROM pipeline_columns col 
  WHERE col.pipeline_id = pc.pipeline_id 
  ORDER BY col.order_position 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 
  FROM pipeline_columns col 
  WHERE col.id = pc.column_id 
  AND col.pipeline_id != pc.pipeline_id
);

-- Add a check to prevent this in the future via trigger
CREATE OR REPLACE FUNCTION validate_card_column_pipeline()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if column belongs to the pipeline
  IF NOT EXISTS (
    SELECT 1 
    FROM pipeline_columns 
    WHERE id = NEW.column_id 
    AND pipeline_id = NEW.pipeline_id
  ) THEN
    RAISE EXCEPTION 'A coluna % não pertence ao pipeline %', NEW.column_id, NEW.pipeline_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_validate_card_column_pipeline ON pipeline_cards;
CREATE TRIGGER trigger_validate_card_column_pipeline
  BEFORE INSERT OR UPDATE ON pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION validate_card_column_pipeline();