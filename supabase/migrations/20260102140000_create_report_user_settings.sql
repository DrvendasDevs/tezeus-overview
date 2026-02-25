-- Configurações de relatório por usuário/workspace (não depende de localStorage)
-- Guarda funis, métricas customizadas e conversões do usuário.

create table if not exists public.report_user_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.system_users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- updated_at trigger
drop trigger if exists update_report_user_settings_updated_at on public.report_user_settings;
create trigger update_report_user_settings_updated_at
  before update on public.report_user_settings
  for each row
  execute function public.update_updated_at_column();

-- RLS
alter table public.report_user_settings enable row level security;

drop policy if exists "report_user_settings_select_own" on public.report_user_settings;
create policy "report_user_settings_select_own"
  on public.report_user_settings
  for select
  using (
    auth.uid() = user_id
    and is_workspace_member(workspace_id, 'user'::system_profile)
  );

drop policy if exists "report_user_settings_insert_own" on public.report_user_settings;
create policy "report_user_settings_insert_own"
  on public.report_user_settings
  for insert
  with check (
    auth.uid() = user_id
    and is_workspace_member(workspace_id, 'user'::system_profile)
  );

drop policy if exists "report_user_settings_update_own" on public.report_user_settings;
create policy "report_user_settings_update_own"
  on public.report_user_settings
  for update
  using (
    auth.uid() = user_id
    and is_workspace_member(workspace_id, 'user'::system_profile)
  )
  with check (
    auth.uid() = user_id
    and is_workspace_member(workspace_id, 'user'::system_profile)
  );

comment on table public.report_user_settings is 'Configurações de relatórios por usuário e workspace (funis, métricas e conversões).';


