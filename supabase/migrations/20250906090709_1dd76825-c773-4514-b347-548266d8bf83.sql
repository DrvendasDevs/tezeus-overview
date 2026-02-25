
-- 1) Enum de papéis e membros de workspace
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('mentor_master','gestor','colaborador');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'colaborador',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 2) Funções de segurança: obter usuário atual e checar papel
CREATE OR REPLACE FUNCTION public.current_system_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT su.id
  FROM public.system_users su
  WHERE su.email = (auth.jwt() ->> 'email')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role public.workspace_role DEFAULT 'colaborador')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_user uuid;
  cur_role public.workspace_role;
BEGIN
  -- Se não há JWT/email, negar
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Mentor master global (via perfil)
  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Papel do usuário no workspace
  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Hierarquia: mentor_master > gestor > colaborador
  -- usuário satisfaz se seu papel >= p_min_role
  IF p_min_role = 'colaborador' THEN
    RETURN TRUE; -- qualquer papel listado atende
  ELSIF p_min_role = 'gestor' THEN
    RETURN cur_role IN ('gestor','mentor_master');
  ELSIF p_min_role = 'mentor_master' THEN
    RETURN cur_role = 'mentor_master';
  END IF;

  RETURN FALSE;
END;
$$;

-- 3) orgs: cnpj, slug e trigger de slugify
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS slug text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='orgs_slug_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX orgs_slug_unique_idx ON public.orgs((lower(slug)));
  END IF;
END$$;

-- Função slugify simples
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(regexp_replace(txt, '\s+', ' ', 'g'))), '[^a-z0-9\- ]', '', 'g')
$$;

-- Trigger para manter slug
CREATE OR REPLACE FUNCTION public.set_org_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.slugify(NEW.name);
  ELSE
    NEW.slug := public.slugify(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orgs_set_slug'
  ) THEN
    CREATE TRIGGER trg_orgs_set_slug
    BEFORE INSERT OR UPDATE OF name, slug ON public.orgs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_org_slug();
  END IF;
END$$;

-- 4) Padronização org_id -> workspace_id (renomear colunas)

-- contacts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='org_id') THEN
    ALTER TABLE public.contacts RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;
ALTER TABLE public.contacts ALTER COLUMN workspace_id DROP DEFAULT;

-- tags
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tags' AND column_name='org_id') THEN
    ALTER TABLE public.tags RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;
ALTER TABLE public.tags ALTER COLUMN workspace_id DROP DEFAULT;

-- clientes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name='org_id') THEN
    ALTER TABLE public.clientes RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;
ALTER TABLE public.clientes ALTER COLUMN workspace_id DROP DEFAULT;

-- conversations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='org_id') THEN
    ALTER TABLE public.conversations RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;
ALTER TABLE public.conversations ALTER COLUMN workspace_id DROP DEFAULT;

-- channels
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='channels' AND column_name='org_id') THEN
    ALTER TABLE public.channels RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;

-- org_messaging_settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='org_messaging_settings' AND column_name='org_id') THEN
    ALTER TABLE public.org_messaging_settings RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;
ALTER TABLE public.org_messaging_settings ALTER COLUMN workspace_id DROP DEFAULT;

-- evolution_instance_tokens
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='evolution_instance_tokens' AND column_name='org_id') THEN
    ALTER TABLE public.evolution_instance_tokens RENAME COLUMN org_id TO workspace_id;
  END IF;
END $$;

-- 5) Foreign keys para orgs(id) onde faltar
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='contacts_workspace_fk'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='tags_workspace_fk'
  ) THEN
    ALTER TABLE public.tags
      ADD CONSTRAINT tags_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='clientes_workspace_fk'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='conversations_workspace_fk'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='channels_workspace_fk'
  ) THEN
    ALTER TABLE public.channels
      ADD CONSTRAINT channels_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='org_messaging_settings_workspace_fk'
  ) THEN
    ALTER TABLE public.org_messaging_settings
      ADD CONSTRAINT org_messaging_settings_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='evolution_instance_tokens_workspace_fk'
  ) THEN
    ALTER TABLE public.evolution_instance_tokens
      ADD CONSTRAINT evolution_instance_tokens_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6) Conexões: remover default 'workspace-zero' e reforçar FK
ALTER TABLE public.connections ALTER COLUMN workspace_id DROP DEFAULT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='connections_workspace_fk'
  ) THEN
    ALTER TABLE public.connections
      ADD CONSTRAINT connections_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 7) Conversas: adicionar connection_id (RESTRICT) e backfill
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS connection_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='conversations_connection_fk'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_connection_fk FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Backfill: casar pelo instance_name = evolution_instance dentro do mesmo workspace
UPDATE public.conversations c
SET connection_id = con.id
FROM public.connections con
WHERE c.connection_id IS NULL
  AND con.instance_name = c.evolution_instance
  AND con.workspace_id = c.workspace_id;

-- Gatilho: manter workspace_id da conversa alinhado com a conexão
CREATE OR REPLACE FUNCTION public.sync_conversation_workspace_from_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conn_ws uuid;
BEGIN
  IF NEW.connection_id IS NOT NULL THEN
    SELECT workspace_id INTO conn_ws FROM public.connections WHERE id = NEW.connection_id;
    IF conn_ws IS NOT NULL THEN
      NEW.workspace_id := conn_ws;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_conversations_sync_workspace'
  ) THEN
    CREATE TRIGGER trg_conversations_sync_workspace
    BEFORE INSERT OR UPDATE OF connection_id ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_workspace_from_connection();
  END IF;
END $$;

-- 8) Messages: adicionar workspace_id, backfill e trigger de herança
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

UPDATE public.messages m
SET workspace_id = c.workspace_id
FROM public.conversations c
WHERE m.workspace_id IS NULL
  AND m.conversation_id = c.id;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='messages_workspace_fk'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.orgs(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_message_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.conversations WHERE id = NEW.conversation_id;
  IF ws IS NOT NULL THEN
    NEW.workspace_id := ws;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_messages_set_workspace'
  ) THEN
    CREATE TRIGGER trg_messages_set_workspace
    BEFORE INSERT OR UPDATE OF conversation_id ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.set_message_workspace();
  END IF;
END $$;

-- 9) Policies por workspace (RLS)

-- conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='Allow all operations on conversations') THEN
    DROP POLICY "Allow all operations on conversations" ON public.conversations;
  END IF;
END $$;

DROP POLICY IF EXISTS conversations_select ON public.conversations;
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
DROP POLICY IF EXISTS conversations_update ON public.conversations;
DROP POLICY IF EXISTS conversations_delete ON public.conversations;

CREATE POLICY conversations_select
  ON public.conversations
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY conversations_insert
  ON public.conversations
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY conversations_update
  ON public.conversations
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY conversations_delete
  ON public.conversations
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='messages' AND policyname='Allow all operations on messages') THEN
    DROP POLICY "Allow all operations on messages" ON public.messages;
  END IF;
END $$;

DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
DROP POLICY IF EXISTS messages_update ON public.messages;
DROP POLICY IF EXISTS messages_delete ON public.messages;

CREATE POLICY messages_select
  ON public.messages
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY messages_insert
  ON public.messages
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY messages_update
  ON public.messages
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY messages_delete
  ON public.messages
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connections_select ON public.connections;
DROP POLICY IF EXISTS connections_insert ON public.connections;
DROP POLICY IF EXISTS connections_update ON public.connections;
DROP POLICY IF EXISTS connections_delete ON public.connections;

CREATE POLICY connections_select
  ON public.connections
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY connections_insert
  ON public.connections
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY connections_update
  ON public.connections
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY connections_delete
  ON public.connections
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_select ON public.contacts;
DROP POLICY IF EXISTS contacts_insert ON public.contacts;
DROP POLICY IF EXISTS contacts_update ON public.contacts;
DROP POLICY IF EXISTS contacts_delete ON public.contacts;

CREATE POLICY contacts_select
  ON public.contacts
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY contacts_insert
  ON public.contacts
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY contacts_update
  ON public.contacts
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY contacts_delete
  ON public.contacts
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select ON public.tags;
DROP POLICY IF EXISTS tags_insert ON public.tags;
DROP POLICY IF EXISTS tags_update ON public.tags;
DROP POLICY IF EXISTS tags_delete ON public.tags;

CREATE POLICY tags_select
  ON public.tags
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY tags_insert
  ON public.tags
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY tags_update
  ON public.tags
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY tags_delete
  ON public.tags
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- channels
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channels_select ON public.channels;
DROP POLICY IF EXISTS channels_insert ON public.channels;
DROP POLICY IF EXISTS channels_update ON public.channels;
DROP POLICY IF EXISTS channels_delete ON public.channels;

CREATE POLICY channels_select
  ON public.channels
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY channels_insert
  ON public.channels
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY channels_update
  ON public.channels
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY channels_delete
  ON public.channels
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- org_messaging_settings
ALTER TABLE public.org_messaging_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_messaging_settings_select ON public.org_messaging_settings;
DROP POLICY IF EXISTS org_messaging_settings_insert ON public.org_messaging_settings;
DROP POLICY IF EXISTS org_messaging_settings_update ON public.org_messaging_settings;
DROP POLICY IF EXISTS org_messaging_settings_delete ON public.org_messaging_settings;

CREATE POLICY org_messaging_settings_select
  ON public.org_messaging_settings
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY org_messaging_settings_insert
  ON public.org_messaging_settings
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY org_messaging_settings_update
  ON public.org_messaging_settings
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY org_messaging_settings_delete
  ON public.org_messaging_settings
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- evolution_instance_tokens
ALTER TABLE public.evolution_instance_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evolution_instance_tokens_select ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS evolution_instance_tokens_insert ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS evolution_instance_tokens_update ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS evolution_instance_tokens_delete ON public.evolution_instance_tokens;

CREATE POLICY evolution_instance_tokens_select
  ON public.evolution_instance_tokens
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY evolution_instance_tokens_insert
  ON public.evolution_instance_tokens
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY evolution_instance_tokens_update
  ON public.evolution_instance_tokens
  FOR UPDATE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

CREATE POLICY evolution_instance_tokens_delete
  ON public.evolution_instance_tokens
  FOR DELETE
  USING (public.is_workspace_member(workspace_id, 'gestor'));

-- workspace_limits
ALTER TABLE public.workspace_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_limits_select ON public.workspace_limits;
DROP POLICY IF EXISTS workspace_limits_manage ON public.workspace_limits;

CREATE POLICY workspace_limits_select
  ON public.workspace_limits
  FOR SELECT
  USING (public.is_workspace_member(workspace_id, 'colaborador'));

CREATE POLICY workspace_limits_manage
  ON public.workspace_limits
  FOR ALL
  USING (public.is_workspace_member(workspace_id, 'gestor'))
  WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'));

-- provider_logs: acesso por conexão -> workspace
ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_logs_select ON public.provider_logs;
DROP POLICY IF EXISTS provider_logs_insert ON public.provider_logs;

CREATE POLICY provider_logs_insert
  ON public.provider_logs
  FOR INSERT
  WITH CHECK (true); -- inserção por service role/funcs

CREATE POLICY provider_logs_select
  ON public.provider_logs
  FOR SELECT
  USING (
    (connection_id IS NULL)
    OR EXISTS (
      SELECT 1
      FROM public.connections c
      WHERE c.id = provider_logs.connection_id
        AND public.is_workspace_member(c.workspace_id, 'colaborador')
    )
  );

-- 10) Migrar org_members -> workspace_members (papéis)
-- Mapear: OWNER/ADMIN -> gestor ; USER -> colaborador
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT om.org_id, om.user_id,
  CASE WHEN om.role IN ('OWNER','ADMIN') THEN 'gestor'::public.workspace_role
       ELSE 'colaborador'::public.workspace_role
  END
FROM public.org_members om
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 11) Tornar MentorMaster membro oculto de todos os workspaces
INSERT INTO public.workspace_members (workspace_id, user_id, role, is_hidden)
SELECT o.id, su.id, 'mentor_master'::public.workspace_role, true
FROM public.orgs o
JOIN public.system_users su ON su.profile = 'master'
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET role = EXCLUDED.role, is_hidden = true;

-- 12) View para cards de workspaces
CREATE OR REPLACE VIEW public.workspaces_view AS
SELECT
  o.id AS workspace_id,
  o.name,
  o.cnpj,
  o.slug,
  o.created_at,
  o.updated_at,
  COALESCE((
    SELECT COUNT(*)::int FROM public.connections c WHERE c.workspace_id = o.id
  ), 0) AS connections_count
FROM public.orgs o;

-- 13) Índices úteis
CREATE INDEX IF NOT EXISTS idx_connections_workspace ON public.connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_connection ON public.conversations(connection_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON public.tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evo_tokens_workspace ON public.evolution_instance_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_org_settings_workspace ON public.org_messaging_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_user ON public.workspace_members(workspace_id, user_id);

-- 14) Opcional: tentar impor NOT NULL em conversations.connection_id se backfill cobriu tudo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE connection_id IS NULL) THEN
    ALTER TABLE public.conversations ALTER COLUMN connection_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Ainda há conversations.connection_id nulos; manteremos como NULL por enquanto.';
  END IF;
END $$;

-- 15) Opcional: impor NOT NULL em messages.workspace_id se coberto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE workspace_id IS NULL) THEN
    ALTER TABLE public.messages ALTER COLUMN workspace_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Ainda há messages.workspace_id nulos; manteremos como NULL por enquanto.';
  END IF;
END $$;

