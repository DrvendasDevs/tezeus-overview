-- Adiciona connection_id no pipeline_cards e ajusta regra de card aberto

-- 1) Adicionar coluna connection_id
ALTER TABLE public.pipeline_cards
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL;

-- 2) Backfill via conversations (quando existir)
UPDATE public.pipeline_cards pc
SET connection_id = c.connection_id
FROM public.conversations c
WHERE pc.conversation_id = c.id
  AND pc.connection_id IS NULL
  AND c.connection_id IS NOT NULL;

-- 3) Índice para consultas por connection_id
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_connection_id
  ON public.pipeline_cards(connection_id);

-- 4) Atualizar regra de unicidade (por workspace + connection_id)
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

    -- Verificar se já existe outro card ABERTO para este contato no MESMO workspace e MESMA conexão
    IF EXISTS (
      SELECT 1
      FROM public.pipeline_cards pc
      JOIN public.pipelines p2 ON p2.id = pc.pipeline_id
      WHERE pc.contact_id = NEW.contact_id
        AND pc.status = 'aberto'
        AND p2.workspace_id = v_workspace_id
        AND pc.id != NEW.id
        AND pc.connection_id IS NOT DISTINCT FROM NEW.connection_id
    ) THEN
      RAISE EXCEPTION 'Já existe um card aberto para este contato nesta empresa e conexão. Finalize (ganho/perda) ou feche o card existente antes de criar um novo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Garantir trigger apontando para a função atualizada
DROP TRIGGER IF EXISTS check_unique_open_card_before_insert_or_update ON public.pipeline_cards;

CREATE TRIGGER check_unique_open_card_before_insert_or_update
  BEFORE INSERT OR UPDATE ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_unique_open_card_per_contact_workspace();
