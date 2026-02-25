-- Adiciona coluna para registrar quando uma ação de status foi executada no card:
-- - ganho
-- - perda/perdido
-- - reaberto (status volta para 'aberto')
--
-- A coluna é atualizada automaticamente via trigger sempre que o status mudar
-- para um desses estados.

ALTER TABLE public.pipeline_cards
ADD COLUMN IF NOT EXISTS status_action_at timestamptz NULL;

COMMENT ON COLUMN public.pipeline_cards.status_action_at IS
'Data/hora da última ação de status executada (ganho/perda/perdido/reaberto). Atualizado automaticamente quando status muda para esses valores.';

-- Função do trigger
CREATE OR REPLACE FUNCTION public.set_pipeline_card_status_action_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só atualizar quando o status realmente mudou e o novo status é um dos alvos
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('ganho', 'perda', 'perdido', 'aberto') THEN
    NEW.status_action_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trigger_set_pipeline_card_status_action_at ON public.pipeline_cards;

CREATE TRIGGER trigger_set_pipeline_card_status_action_at
  BEFORE UPDATE ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pipeline_card_status_action_at();


