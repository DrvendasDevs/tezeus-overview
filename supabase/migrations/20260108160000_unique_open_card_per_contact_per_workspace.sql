-- Regra: não permitir 2 oportunidades (cards) com status 'aberto' para o MESMO contato dentro do MESMO workspace,
-- independente da pipeline.
--
-- Isso substitui a regra anterior "por pipeline" (contact_id + pipeline_id), que permitia múltiplos abertos
-- em pipelines diferentes.

-- 1) Remover índice antigo (por pipeline) se existir
DROP INDEX IF EXISTS public.idx_unique_contact_pipeline_open;

-- 2) Criar/atualizar função de validação (por workspace)
CREATE OR REPLACE FUNCTION public.validate_unique_open_card_per_contact_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Apenas validar se o novo/atualizado card está com status 'aberto'
  IF NEW.status = 'aberto' AND NEW.contact_id IS NOT NULL THEN
    -- Descobrir o workspace do pipeline do card
    SELECT p.workspace_id
      INTO v_workspace_id
    FROM public.pipelines p
    WHERE p.id = NEW.pipeline_id;

    -- Se não encontrar pipeline, deixar falhar com mensagem clara
    IF v_workspace_id IS NULL THEN
      RAISE EXCEPTION 'Pipeline inválido para criação/atualização do card.';
    END IF;

    -- Verificar se já existe outro card ABERTO para este contato em QUALQUER pipeline deste workspace
    IF EXISTS (
      SELECT 1
      FROM public.pipeline_cards pc
      JOIN public.pipelines p2 ON p2.id = pc.pipeline_id
      WHERE pc.contact_id = NEW.contact_id
        AND pc.status = 'aberto'
        AND p2.workspace_id = v_workspace_id
        AND pc.id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe um card aberto para este contato nesta empresa. Finalize (ganho/perda) ou feche o card existente antes de criar um novo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Recriar trigger apontando para a nova função
DROP TRIGGER IF EXISTS check_unique_open_card_before_insert_or_update ON public.pipeline_cards;

CREATE TRIGGER check_unique_open_card_before_insert_or_update
  BEFORE INSERT OR UPDATE ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_unique_open_card_per_contact_workspace();


