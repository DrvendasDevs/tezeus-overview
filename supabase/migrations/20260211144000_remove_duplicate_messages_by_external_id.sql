-- Remove duplicidades de messages.external_id mantendo apenas 1 registro por external_id.
-- Critério de retenção: provider_moment mais recente, depois created_at mais recente, depois id.
-- Também corrige referências em reply_to_message_id e notifications.message_id antes da remoção.

CREATE TEMP TABLE tmp_message_external_id_dedupe AS
WITH ranked AS (
  SELECT
    m.id,
    m.external_id,
    FIRST_VALUE(m.id) OVER (
      PARTITION BY m.external_id
      ORDER BY m.provider_moment DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY m.external_id
      ORDER BY m.provider_moment DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id DESC
    ) AS rn
  FROM public.messages m
  WHERE m.external_id IS NOT NULL
)
SELECT id AS drop_id, keep_id, external_id
FROM ranked
WHERE rn > 1;

-- Atualiza replies que apontavam para mensagens duplicadas que serão removidas.
UPDATE public.messages m
SET reply_to_message_id = d.keep_id
FROM tmp_message_external_id_dedupe d
WHERE m.reply_to_message_id = d.drop_id
  AND m.reply_to_message_id IS DISTINCT FROM d.keep_id;

-- Se a tabela notifications existir, evita conflito da constraint UNIQUE (user_id, message_id)
-- removendo notificações duplicadas antes de remapear para keep_id.
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications n
    USING tmp_message_external_id_dedupe d
    WHERE n.message_id = d.drop_id
      AND EXISTS (
        SELECT 1
        FROM public.notifications n2
        WHERE n2.user_id = n.user_id
          AND n2.message_id = d.keep_id
      );

    UPDATE public.notifications n
    SET message_id = d.keep_id
    FROM tmp_message_external_id_dedupe d
    WHERE n.message_id = d.drop_id
      AND n.message_id IS DISTINCT FROM d.keep_id;
  END IF;
END $$;

-- Remove os registros duplicados de messages.
DELETE FROM public.messages m
USING tmp_message_external_id_dedupe d
WHERE m.id = d.drop_id;
