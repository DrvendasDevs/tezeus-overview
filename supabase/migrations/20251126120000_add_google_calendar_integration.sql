BEGIN;

-- Tabela principal de autorizações da Google Agenda
CREATE TABLE IF NOT EXISTS public.google_calendar_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  google_user_id text,
  google_email text NOT NULL,
  refresh_token text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  authorized_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_token_check_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.google_calendar_authorizations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_cal_auth_user_workspace 
  ON public.google_calendar_authorizations(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_google_cal_auth_email 
  ON public.google_calendar_authorizations(google_email);

DROP TRIGGER IF EXISTS update_google_calendar_authorizations_updated_at 
  ON public.google_calendar_authorizations;

CREATE TRIGGER update_google_calendar_authorizations_updated_at
  BEFORE UPDATE ON public.google_calendar_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Estados temporários para o fluxo OAuth
CREATE TABLE IF NOT EXISTS public.google_calendar_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_google_cal_states_expires_at 
  ON public.google_calendar_oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_google_cal_states_user_workspace 
  ON public.google_calendar_oauth_states(user_id, workspace_id);

COMMIT;

