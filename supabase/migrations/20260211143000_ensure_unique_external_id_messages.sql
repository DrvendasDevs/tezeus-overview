-- Garante unicidade global de external_id na tabela messages.
-- Mantem multiplos NULLs permitidos (apenas IDs reais precisam ser unicos).
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique
  ON public.messages (external_id)
  WHERE external_id IS NOT NULL;
