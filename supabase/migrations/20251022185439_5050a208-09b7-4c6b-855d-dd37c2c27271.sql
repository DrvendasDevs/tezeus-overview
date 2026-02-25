-- Função de validação para garantir apenas 1 card aberto por contato por pipeline
CREATE OR REPLACE FUNCTION public.validate_unique_open_card_per_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Apenas validar se o novo/atualizado card está com status 'aberto'
  IF NEW.status = 'aberto' AND NEW.contact_id IS NOT NULL THEN
    -- Verificar se já existe outro card aberto para este contato neste pipeline
    IF EXISTS (
      SELECT 1 
      FROM public.pipeline_cards 
      WHERE contact_id = NEW.contact_id 
        AND pipeline_id = NEW.pipeline_id 
        AND status = 'aberto'
        AND id != NEW.id  -- Excluir o próprio card (importante para updates)
    ) THEN
      RAISE EXCEPTION 'Já existe um card aberto para este contato neste pipeline. Finalize o card anterior antes de criar um novo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para validar antes de inserir ou atualizar
DROP TRIGGER IF EXISTS check_unique_open_card_before_insert_or_update ON public.pipeline_cards;

CREATE TRIGGER check_unique_open_card_before_insert_or_update
  BEFORE INSERT OR UPDATE ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_unique_open_card_per_contact();