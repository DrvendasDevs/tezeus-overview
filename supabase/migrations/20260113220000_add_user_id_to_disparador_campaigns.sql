-- Adicionar coluna user_id para armazenar o ID do usuário que criou a campanha
-- (created_by já existe, mas user_id é mais explícito para integração com n8n)

ALTER TABLE public.disparador_campaigns
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Copiar dados de created_by para user_id (se created_by tiver dados)
UPDATE public.disparador_campaigns
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_disparador_campaigns_user_id
  ON public.disparador_campaigns(user_id);

COMMENT ON COLUMN public.disparador_campaigns.user_id IS 'ID do usuário que criou a campanha';
