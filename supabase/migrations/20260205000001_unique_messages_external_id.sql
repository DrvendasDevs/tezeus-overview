-- Garantir external_id único globalmente em messages
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique
  ON public.messages(external_id)
  WHERE external_id IS NOT NULL;
