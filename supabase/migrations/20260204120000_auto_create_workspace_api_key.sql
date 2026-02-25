-- ============================================================================
-- Migration: Criar API Key automaticamente ao criar workspace
-- Descrição:
--  - Ao inserir em public.workspaces, cria 1 chave em public.workspace_api_keys
--  - Formato: tezeus-<32 chars alfanuméricos>
--  - Também faz backfill para workspaces existentes sem chave
-- ============================================================================

-- Função para gerar token alfanumérico (A-Za-z0-9) com 32 caracteres
CREATE OR REPLACE FUNCTION public.generate_tezeus_api_token_32()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  raw text;
  tok text;
BEGIN
  LOOP
    -- base64 gera A-Z a-z 0-9 + / e = (padding). Removemos tudo que não for alfanumérico.
    raw := encode(gen_random_bytes(48), 'base64');
    tok := regexp_replace(raw, '[^A-Za-z0-9]', '', 'g');
    IF length(tok) >= 32 THEN
      RETURN substr(tok, 1, 32);
    END IF;
  END LOOP;
END;
$$;

-- Trigger function: cria a chave ao inserir workspace
CREATE OR REPLACE FUNCTION public.create_default_workspace_api_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_key text;
BEGIN
  -- Evita duplicar caso já exista alguma key para este workspace
  IF EXISTS (
    SELECT 1
    FROM public.workspace_api_keys wak
    WHERE wak.workspace_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  LOOP
    new_key := 'tezeus-' || public.generate_tezeus_api_token_32();
    BEGIN
      INSERT INTO public.workspace_api_keys (workspace_id, api_key, name, is_active)
      VALUES (NEW.id, new_key, 'Default', true);
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- Gera outra e tenta novamente
        NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Criar trigger (AFTER INSERT) em workspaces
DROP TRIGGER IF EXISTS trg_create_default_workspace_api_key ON public.workspaces;
CREATE TRIGGER trg_create_default_workspace_api_key
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.create_default_workspace_api_key();

-- Backfill: criar chave para workspaces existentes sem key
DO $$
DECLARE
  ws record;
  new_key text;
BEGIN
  FOR ws IN
    SELECT w.id
    FROM public.workspaces w
    WHERE w.id <> '00000000-0000-0000-0000-000000000000'
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace_api_keys wak WHERE wak.workspace_id = w.id
      )
  LOOP
    LOOP
      new_key := 'tezeus-' || public.generate_tezeus_api_token_32();
      BEGIN
        INSERT INTO public.workspace_api_keys (workspace_id, api_key, name, is_active)
        VALUES (ws.id, new_key, 'Default', true);
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

