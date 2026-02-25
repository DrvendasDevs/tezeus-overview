-- =========================================================
-- Disparador (Campanhas / Listas / Métricas)
-- =========================================================
-- Objetivo:
-- - Persistir contatos importados (nome/telefone/tag + nome_do_documento)
-- - Persistir campanhas, mensagens (3 variações) e vínculos de contatos
-- - Registrar tentativas de envio (sucesso/falha) e respostas (any/positiva/negativa)
-- Observação:
-- - Métricas serão calculadas a partir das tabelas de eventos. 

-- 1) Tipos (enums)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disparador_campaign_status') THEN
    CREATE TYPE public.disparador_campaign_status AS ENUM ('nao_configurada', 'disparando', 'concluida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disparador_send_status') THEN
    CREATE TYPE public.disparador_send_status AS ENUM ('queued', 'sent', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disparador_response_kind') THEN
    CREATE TYPE public.disparador_response_kind AS ENUM ('any', 'positive', 'negative');
  END IF;
END $$;

-- 2) Contatos importados (Listas)
CREATE TABLE IF NOT EXISTS public.disparador_contacts_imported (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  tag text NOT NULL,
  document_name text NOT NULL,
  created_by uuid DEFAULT current_system_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS disparador_contacts_unique_per_doc
  ON public.disparador_contacts_imported(workspace_id, phone, tag, document_name);
CREATE INDEX IF NOT EXISTS disparador_contacts_by_workspace
  ON public.disparador_contacts_imported(workspace_id);
CREATE INDEX IF NOT EXISTS disparador_contacts_by_workspace_tag
  ON public.disparador_contacts_imported(workspace_id, tag);
CREATE INDEX IF NOT EXISTS disparador_contacts_by_workspace_document
  ON public.disparador_contacts_imported(workspace_id, document_name);

-- 3) Campanhas
CREATE TABLE IF NOT EXISTS public.disparador_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.disparador_campaign_status NOT NULL DEFAULT 'nao_configurada',
  start_at timestamptz NULL,
  created_by uuid DEFAULT current_system_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disparador_campaigns_by_workspace_status
  ON public.disparador_campaigns(workspace_id, status);

-- 4) Mensagens (3 variações)
CREATE TABLE IF NOT EXISTS public.disparador_campaign_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.disparador_campaigns(id) ON DELETE CASCADE,
  variation smallint NOT NULL CHECK (variation BETWEEN 1 AND 3),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS disparador_campaign_messages_unique
  ON public.disparador_campaign_messages(campaign_id, variation);

-- 5) Contatos vinculados à campanha
CREATE TABLE IF NOT EXISTS public.disparador_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.disparador_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.disparador_contacts_imported(id) ON DELETE CASCADE,
  created_by uuid DEFAULT current_system_user_id(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS disparador_campaign_contacts_unique
  ON public.disparador_campaign_contacts(campaign_id, contact_id);
CREATE INDEX IF NOT EXISTS disparador_campaign_contacts_by_campaign
  ON public.disparador_campaign_contacts(campaign_id);

-- 6) Eventos de envio (n8n → Tezeus)
-- status:
-- - queued: o sistema solicitou o disparo (webhook disparado)
-- - sent: n8n confirmou envio
-- - failed: n8n confirmou falha
CREATE TABLE IF NOT EXISTS public.disparador_send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.disparador_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.disparador_contacts_imported(id) ON DELETE CASCADE,
  triggered_by uuid DEFAULT current_system_user_id(),
  status public.disparador_send_status NOT NULL,
  external_id text NULL,
  error text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- "Estado" por contato na campanha (última tentativa conhecida). Upsert pelo webhook.
CREATE UNIQUE INDEX IF NOT EXISTS disparador_send_events_unique_contact
  ON public.disparador_send_events(campaign_id, contact_id);

CREATE INDEX IF NOT EXISTS disparador_send_events_by_workspace_date
  ON public.disparador_send_events(workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS disparador_send_events_by_campaign_status
  ON public.disparador_send_events(campaign_id, status);
CREATE INDEX IF NOT EXISTS disparador_send_events_by_triggered_by
  ON public.disparador_send_events(triggered_by);

-- 7) Eventos de resposta (n8n/webhook WhatsApp → Tezeus)
CREATE TABLE IF NOT EXISTS public.disparador_response_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.disparador_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.disparador_contacts_imported(id) ON DELETE CASCADE,
  kind public.disparador_response_kind NOT NULL DEFAULT 'any',
  raw text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- "Estado" por contato na campanha (última resposta conhecida). Upsert pelo webhook.
CREATE UNIQUE INDEX IF NOT EXISTS disparador_response_events_unique_contact
  ON public.disparador_response_events(campaign_id, contact_id);

CREATE INDEX IF NOT EXISTS disparador_response_events_by_workspace_date
  ON public.disparador_response_events(workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS disparador_response_events_by_campaign_kind
  ON public.disparador_response_events(campaign_id, kind);

-- 8) RLS + Policies (padrão Tezeus: workspace membership)
ALTER TABLE public.disparador_contacts_imported ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparador_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparador_campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparador_campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparador_send_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disparador_response_events ENABLE ROW LEVEL SECURITY;

-- Helper inline (evita depender de public.is_workspace_member)
-- Considera membro qualquer usuário presente em workspace_members do workspace.
-- OBS: usamos current_system_user_id() que já é padrão no Tezeus.

-- Contatos importados
DROP POLICY IF EXISTS "disparador_contacts_select" ON public.disparador_contacts_imported;
DROP POLICY IF EXISTS "disparador_contacts_insert" ON public.disparador_contacts_imported;
DROP POLICY IF EXISTS "disparador_contacts_update" ON public.disparador_contacts_imported;
DROP POLICY IF EXISTS "disparador_contacts_delete" ON public.disparador_contacts_imported;

CREATE POLICY "disparador_contacts_select" ON public.disparador_contacts_imported
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_contacts_imported.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_contacts_insert" ON public.disparador_contacts_imported
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_contacts_imported.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_contacts_update" ON public.disparador_contacts_imported
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_contacts_imported.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_contacts_delete" ON public.disparador_contacts_imported
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_contacts_imported.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );

-- Campanhas
DROP POLICY IF EXISTS "disparador_campaigns_select" ON public.disparador_campaigns;
DROP POLICY IF EXISTS "disparador_campaigns_insert" ON public.disparador_campaigns;
DROP POLICY IF EXISTS "disparador_campaigns_update" ON public.disparador_campaigns;
DROP POLICY IF EXISTS "disparador_campaigns_delete" ON public.disparador_campaigns;

CREATE POLICY "disparador_campaigns_select" ON public.disparador_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_campaigns.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_campaigns_insert" ON public.disparador_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_campaigns.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_campaigns_update" ON public.disparador_campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_campaigns.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_campaigns_delete" ON public.disparador_campaigns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_campaigns.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );

-- Mensagens
DROP POLICY IF EXISTS "disparador_campaign_messages_select" ON public.disparador_campaign_messages;
DROP POLICY IF EXISTS "disparador_campaign_messages_insert" ON public.disparador_campaign_messages;
DROP POLICY IF EXISTS "disparador_campaign_messages_update" ON public.disparador_campaign_messages;
DROP POLICY IF EXISTS "disparador_campaign_messages_delete" ON public.disparador_campaign_messages;

CREATE POLICY "disparador_campaign_messages_select" ON public.disparador_campaign_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_messages_insert" ON public.disparador_campaign_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_messages_update" ON public.disparador_campaign_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_messages_delete" ON public.disparador_campaign_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );

-- Vínculos campanha ↔ contatos
DROP POLICY IF EXISTS "disparador_campaign_contacts_select" ON public.disparador_campaign_contacts;
DROP POLICY IF EXISTS "disparador_campaign_contacts_insert" ON public.disparador_campaign_contacts;
DROP POLICY IF EXISTS "disparador_campaign_contacts_update" ON public.disparador_campaign_contacts;
DROP POLICY IF EXISTS "disparador_campaign_contacts_delete" ON public.disparador_campaign_contacts;

CREATE POLICY "disparador_campaign_contacts_select" ON public.disparador_campaign_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_contacts_insert" ON public.disparador_campaign_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_contacts_update" ON public.disparador_campaign_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );
CREATE POLICY "disparador_campaign_contacts_delete" ON public.disparador_campaign_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.disparador_campaigns c
      WHERE c.id = campaign_id
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = c.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  );

-- Eventos de envio
DROP POLICY IF EXISTS "disparador_send_events_select" ON public.disparador_send_events;
DROP POLICY IF EXISTS "disparador_send_events_insert" ON public.disparador_send_events;
DROP POLICY IF EXISTS "disparador_send_events_update" ON public.disparador_send_events;
DROP POLICY IF EXISTS "disparador_send_events_delete" ON public.disparador_send_events;

CREATE POLICY "disparador_send_events_select" ON public.disparador_send_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_send_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_send_events_insert" ON public.disparador_send_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_send_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_send_events_update" ON public.disparador_send_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_send_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_send_events_delete" ON public.disparador_send_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_send_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );

-- Eventos de resposta
DROP POLICY IF EXISTS "disparador_response_events_select" ON public.disparador_response_events;
DROP POLICY IF EXISTS "disparador_response_events_insert" ON public.disparador_response_events;
DROP POLICY IF EXISTS "disparador_response_events_update" ON public.disparador_response_events;
DROP POLICY IF EXISTS "disparador_response_events_delete" ON public.disparador_response_events;

CREATE POLICY "disparador_response_events_select" ON public.disparador_response_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_response_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_response_events_insert" ON public.disparador_response_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_response_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_response_events_update" ON public.disparador_response_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_response_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );
CREATE POLICY "disparador_response_events_delete" ON public.disparador_response_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = disparador_response_events.workspace_id
      AND wm.user_id = current_system_user_id()
    )
  );

